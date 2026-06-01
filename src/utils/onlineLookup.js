const JISHO_URL = 'https://jisho.org/api/v1/search/words?keyword=';
const KANJI_API_URL = 'https://kanjiapi.dev/v1';
const TRANSLATE_URL = 'https://api.mymemory.translated.net/get';

const COMMON_TRANSLATIONS = {
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

function hasJapanese(text) {
  return /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(text);
}

function cleanText(value) {
  return String(value || '').trim();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Data online tidak bisa diambil.');
  return response.json();
}

async function translate(text, from, to) {
  const source = cleanText(text);
  if (!source) return '';
  const simple = source.toLowerCase();
  if (from === 'en' && to === 'id' && COMMON_TRANSLATIONS[simple]) return COMMON_TRANSLATIONS[simple];
  try {
    const url = `${TRANSLATE_URL}?q=${encodeURIComponent(source)}&langpair=${from}|${to}`;
    const data = await fetchJson(url);
    return cleanText(data?.responseData?.translatedText) || source;
  } catch {
    return source;
  }
}

async function translateGlosses(glosses) {
  const list = Array.isArray(glosses) ? glosses : [glosses];
  const translated = await Promise.all(list.filter(Boolean).slice(0, 3).map((item) => translate(item, 'en', 'id')));
  return translated.join(', ');
}

function mapWordType(parts = []) {
  const text = parts.join(' ').toLowerCase();
  if (text.includes('verb')) return 'kata kerja';
  if (text.includes('adjective')) return 'kata sifat';
  if (text.includes('adverb')) return 'kata keterangan';
  if (text.includes('noun')) return 'kata benda';
  if (text.includes('expression')) return 'ungkapan';
  if (text.includes('particle')) return 'partikel';
  if (text.includes('suffix') || text.includes('prefix')) return 'imbuhan';
  return 'lainnya';
}

function normalizeJishoWord(entry) {
  const japanese = entry?.japanese?.find((item) => item.word || item.reading) || {};
  const sense = entry?.senses?.[0] || {};
  const word = japanese.word || japanese.reading || '';
  const reading = japanese.reading || japanese.word || '';
  const meaningEn = (sense.english_definitions || []).join(', ');
  const type = mapWordType(sense.parts_of_speech || []);

  return {
    word,
    reading,
    meaningEn,
    type,
    deck: 'Online Lookup',
    lesson: 0,
    section: 'Online Lookup',
    status: 'new',
    wrongCount: 0,
    correctCount: 0,
  };
}

export async function lookupVocabulary(query) {
  const raw = cleanText(query);
  if (!raw) throw new Error('Masukkan kata terlebih dahulu.');

  try {
    return await fetchJson(`/api/lookup-vocab?q=${encodeURIComponent(raw)}`);
  } catch {
    // Local Vite runs without Vercel serverless functions. Fall back to direct browser calls.
  }

  const searchTerm = hasJapanese(raw) ? raw : await translate(raw, 'id', 'en');
  const jisho = await fetchJson(`${JISHO_URL}${encodeURIComponent(searchTerm)}`);
  const first = jisho?.data?.[0];
  if (!first) throw new Error('Kotoba tidak ditemukan dari pencarian online.');

  const item = normalizeJishoWord(first);
  const meaningId = await translate(item.meaningEn, 'en', 'id');
  return {
    ...item,
    meaning: meaningId || item.meaningEn,
    sourceMeaning: item.meaningEn,
  };
}

function normalizeKanjiWord(entry) {
  if (Array.isArray(entry)) {
    const variants = entry[0] || [];
    const meanings = entry[1] || [];
    const firstVariant = variants[0] || {};
    const glosses = Array.isArray(meanings) ? meanings.flatMap((meaning) => typeof meaning === 'string' ? meaning : meaning?.glosses || []) : [meanings];
    return {
      word: firstVariant.written || firstVariant.word || firstVariant[0] || '',
      reading: firstVariant.pronounced || firstVariant.reading || firstVariant[1] || '',
      meaningEn: glosses.join(', '),
    };
  }

  const variants = entry?.variants || entry?.japanese || [];
  const firstVariant = variants[0] || {};
  const meanings = entry?.meanings || entry?.senses?.[0]?.english_definitions || [];
  const glosses = Array.isArray(meanings) ? meanings.flatMap((meaning) => typeof meaning === 'string' ? meaning : meaning?.glosses || []) : [meanings];
  return {
    word: firstVariant.written || firstVariant.word || entry?.word || '',
    reading: firstVariant.pronounced || firstVariant.reading || entry?.reading || '',
    meaningEn: glosses.join(', '),
  };
}

export async function lookupKanji(char) {
  const kanji = Array.from(cleanText(char)).find((item) => /\p{Script=Han}/u.test(item));
  if (!kanji) throw new Error('Masukkan satu kanji terlebih dahulu.');

  try {
    return await fetchJson(`/api/lookup-kanji?q=${encodeURIComponent(kanji)}`);
  } catch {
    // Local Vite runs without Vercel serverless functions. Fall back to direct browser calls.
  }

  const info = await fetchJson(`${KANJI_API_URL}/kanji/${encodeURIComponent(kanji)}`);
  const meaningEn = (info.meanings || []).join(', ');
  const meaning = await translateGlosses(info.meanings || []);

  let words = [];
  try {
    const wordData = await fetchJson(`${KANJI_API_URL}/words/${encodeURIComponent(kanji)}`);
    const firstWords = Array.isArray(wordData) ? wordData.slice(0, 8) : [];
    words = await Promise.all(firstWords.map(async (entry) => {
      const item = normalizeKanjiWord(entry);
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
    words = words.filter((item) => item.word && item.reading && item.meaning);
  } catch {
    words = [];
  }

  return {
    kanji,
    meaning,
    meaningEn,
    strokeCount: info.stroke_count || 0,
    jlpt: info.jlpt || '',
    grade: info.grade || '',
    kunReadings: info.kun_readings || [],
    onReadings: info.on_readings || [],
    words,
  };
}
