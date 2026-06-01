const KANJI_API_URL = 'https://kanjiapi.dev/v1';
const TRANSLATE_URL = 'https://api.mymemory.translated.net/get';

const COMMON_EN_TO_ID = {
  water: 'air',
  fire: 'api',
  tree: 'pohon',
  wood: 'kayu',
  person: 'orang',
  mouth: 'mulut',
  mountain: 'gunung',
  river: 'sungai',
  sun: 'matahari',
  day: 'hari',
  moon: 'bulan',
  month: 'bulan',
  year: 'tahun',
  book: 'buku',
  school: 'sekolah',
  car: 'mobil',
  electricity: 'listrik',
  money: 'uang',
  gold: 'emas',
  country: 'negara',
  woman: 'perempuan',
  man: 'laki-laki',
  child: 'anak',
  small: 'kecil',
  big: 'besar',
  up: 'atas',
  down: 'bawah',
  middle: 'tengah',
  inside: 'dalam',
  outside: 'luar',
  east: 'timur',
  west: 'barat',
  south: 'selatan',
  north: 'utara',
  white: 'putih',
  red: 'merah',
  blue: 'biru',
  black: 'hitam',
};

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Lookup gagal.');
  return response.json();
}

async function translate(text) {
  const source = String(text || '').trim();
  if (!source) return '';
  const simple = source.toLowerCase();
  if (COMMON_EN_TO_ID[simple]) return COMMON_EN_TO_ID[simple];
  try {
    const data = await fetchJson(`${TRANSLATE_URL}?q=${encodeURIComponent(source)}&langpair=en|id`);
    return data?.responseData?.translatedText || source;
  } catch {
    return source;
  }
}

async function translateGlosses(glosses) {
  const list = Array.isArray(glosses) ? glosses : [glosses];
  const translated = await Promise.all(list.filter(Boolean).slice(0, 3).map((item) => translate(item)));
  return translated.join(', ');
}

function normalizeWord(entry) {
  const variants = entry?.variants || [];
  const firstVariant = variants[0] || {};
  const meanings = entry?.meanings || [];
  const glosses = Array.isArray(meanings) ? meanings.flatMap((meaning) => meaning?.glosses || []) : [];
  return {
    word: firstVariant.written || '',
    reading: firstVariant.pronounced || '',
    meaningEn: glosses.join(', '),
  };
}

export default async function handler(request, response) {
  try {
    const kanji = Array.from(String(request.query.q || '').trim()).find((item) => /\p{Script=Han}/u.test(item));
    if (!kanji) return response.status(400).json({ error: 'Masukkan satu kanji terlebih dahulu.' });

    const info = await fetchJson(`${KANJI_API_URL}/kanji/${encodeURIComponent(kanji)}`);
    const wordData = await fetchJson(`${KANJI_API_URL}/words/${encodeURIComponent(kanji)}`);
    const words = await Promise.all((Array.isArray(wordData) ? wordData.slice(0, 8) : []).map(async (entry) => {
      const item = normalizeWord(entry);
      return {
        ...item,
        meaning: await translateGlosses(item.meaningEn.split(', ')),
        type: 'kata benda',
        deck: `Kanji ${kanji}`,
        lesson: 0,
        section: 'Kotoba dari kanji',
        status: 'new',
        wrongCount: 0,
        correctCount: 0,
      };
    }));

    return response.status(200).json({
      kanji,
      meaning: await translateGlosses(info.meanings || []),
      meaningEn: (info.meanings || []).join(', '),
      strokeCount: info.stroke_count || 0,
      jlpt: info.jlpt || '',
      grade: info.grade || '',
      kunReadings: info.kun_readings || [],
      onReadings: info.on_readings || [],
      words: words.filter((item) => item.word && item.reading && item.meaning),
    });
  } catch (error) {
    return response.status(500).json({ error: error.message || 'Pencarian kanji gagal.' });
  }
}
