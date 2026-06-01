const JISHO_URL = 'https://jisho.org/api/v1/search/words?keyword=';
const TRANSLATE_URL = 'https://api.mymemory.translated.net/get';

const COMMON_ID_TO_EN = {
  makan: 'eat',
  minum: 'drink',
  pergi: 'go',
  datang: 'come',
  melihat: 'see',
  membaca: 'read',
  menulis: 'write',
  mendengar: 'hear',
  membeli: 'buy',
  belajar: 'study',
  bekerja: 'work',
  rumah: 'house',
  sekolah: 'school',
  air: 'water',
  api: 'fire',
};

const COMMON_EN_TO_ID = {
  water: 'air',
  fire: 'api',
  eat: 'makan',
  drink: 'minum',
  go: 'pergi',
  come: 'datang',
  see: 'melihat',
  read: 'membaca',
  write: 'menulis',
  hear: 'mendengar',
  buy: 'membeli',
  study: 'belajar',
  work: 'bekerja',
  house: 'rumah',
  school: 'sekolah',
};

function hasJapanese(text) {
  return /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(text);
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

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Lookup gagal.');
  return response.json();
}

async function translate(text, from, to) {
  const source = String(text || '').trim();
  if (!source) return '';
  const lower = source.toLowerCase();
  if (from === 'id' && to === 'en' && COMMON_ID_TO_EN[lower]) return COMMON_ID_TO_EN[lower];
  if (from === 'en' && to === 'id' && COMMON_EN_TO_ID[lower]) return COMMON_EN_TO_ID[lower];
  try {
    const data = await fetchJson(`${TRANSLATE_URL}?q=${encodeURIComponent(source)}&langpair=${from}|${to}`);
    return data?.responseData?.translatedText || source;
  } catch {
    return source;
  }
}

export default async function handler(request, response) {
  try {
    const query = String(request.query.q || '').trim();
    if (!query) return response.status(400).json({ error: 'Masukkan kata terlebih dahulu.' });

    const searchTerm = hasJapanese(query) ? query : await translate(query, 'id', 'en');
    const jisho = await fetchJson(`${JISHO_URL}${encodeURIComponent(searchTerm)}`);
    const first = jisho?.data?.[0];
    if (!first) return response.status(404).json({ error: 'Kotoba tidak ditemukan.' });

    const japanese = first.japanese?.find((item) => item.word || item.reading) || {};
    const sense = first.senses?.[0] || {};
    const meaningEn = (sense.english_definitions || []).join(', ');
    const meaning = await translate(meaningEn, 'en', 'id');

    return response.status(200).json({
      word: japanese.word || japanese.reading || '',
      reading: japanese.reading || japanese.word || '',
      meaning,
      sourceMeaning: meaningEn,
      type: mapWordType(sense.parts_of_speech || []),
      deck: 'Online Lookup',
      lesson: 0,
      section: 'Online Lookup',
      status: 'new',
      wrongCount: 0,
      correctCount: 0,
    });
  } catch (error) {
    return response.status(500).json({ error: error.message || 'Pencarian online gagal.' });
  }
}
