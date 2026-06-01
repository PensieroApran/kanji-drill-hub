import { useMemo, useState } from 'react';
import { kanjiData } from './data/kanjiData';
import { vocabData } from './data/vocabData';
import { lookupKanji, lookupVocabulary } from './utils/onlineLookup';

const STORAGE = {
  kanji: 'kdh-kanji-status',
  importedKanji: 'kdh-imported-kanji',
  kanjiDetails: 'kdh-kanji-details',
  vocab: 'kdh-vocab-progress',
  imported: 'kdh-imported-vocab',
  stats: 'kdh-quiz-stats',
};

const navItems = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'kanji', label: 'Kanji Bank' },
  { id: 'deck', label: 'Deck Kotoba' },
  { id: 'add-data', label: 'Tambah Data' },
  { id: 'quiz', label: 'Kuis Cepat' },
  { id: 'kanji-quiz', label: 'Kuis Kanji' },
  { id: 'review', label: 'Review Salah' },
  { id: 'exam', label: 'Exam Mode' },
];

const quizModes = [
  { id: 'jp-id', label: 'Jepang ke Indonesia', prompt: 'word', answer: 'meaning' },
  { id: 'id-jp', label: 'Indonesia ke Jepang', prompt: 'meaning', answer: 'word' },
  { id: 'jp-hira', label: 'Jepang ke Hiragana', prompt: 'word', answer: 'reading' },
  { id: 'hira-jp', label: 'Hiragana ke Jepang', prompt: 'reading', answer: 'word' },
];

const counts = [10, 20, 50, 100, 'all'];
const kanjiRanges = [
  { label: 'Semua', min: 1, max: Infinity },
  { label: '1-50', min: 1, max: 50 },
  { label: '51-100', min: 51, max: 100 },
  { label: '101-150', min: 101, max: 150 },
  { label: '151-200', min: 151, max: 200 },
  { label: '201-250', min: 201, max: 250 },
  { label: '251-300', min: 251, max: 300 },
  { label: '301+', min: 301, max: Infinity },
];

function loadJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function shuffle(list) {
  return [...list].sort(() => Math.random() - 0.5);
}

function normalize(value) {
  return String(value).toLowerCase().trim();
}

function mergeProgress(items, progress) {
  return items.map((item) => ({ ...item, ...(progress[item.id] || {}) }));
}

function makeOptions(question, pool, mode) {
  const answerKey = mode.answer;
  const uniqueWrong = pool
    .filter((item) => item.id !== question.id)
    .map((item) => item[answerKey])
    .filter((value, index, arr) => value && arr.indexOf(value) === index);
  return shuffle([question[answerKey], ...shuffle(uniqueWrong).slice(0, 3)]);
}

function App() {
  const [page, setPage] = useState('dashboard');
  const [kanjiStatus, setKanjiStatus] = useState(() => loadJson(STORAGE.kanji, {}));
  const [importedKanji, setImportedKanji] = useState(() => loadJson(STORAGE.importedKanji, []));
  const [kanjiDetails, setKanjiDetails] = useState(() => loadJson(STORAGE.kanjiDetails, {}));
  const [vocabProgress, setVocabProgress] = useState(() => loadJson(STORAGE.vocab, {}));
  const [imported, setImported] = useState(() => loadJson(STORAGE.imported, []));
  const [stats, setStats] = useState(() => loadJson(STORAGE.stats, { correct: 0, total: 0 }));

  const allKanji = useMemo(() => [...kanjiData, ...importedKanji], [importedKanji]);
  const allVocab = useMemo(() => mergeProgress([...vocabData, ...imported], vocabProgress), [imported, vocabProgress]);
  const decks = useMemo(() => [...new Set(allVocab.map((item) => item.deck))], [allVocab]);
  const difficultCount = allVocab.filter((item) => item.status === 'difficult' || item.wrongCount > 0).length;
  const accuracy = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;

  function updateKanji(char, status) {
    const next = { ...kanjiStatus, [char]: status };
    setKanjiStatus(next);
    saveJson(STORAGE.kanji, next);
  }

  function updateVocab(id, patch) {
    const current = vocabProgress[id] || {};
    const next = { ...vocabProgress, [id]: { ...current, ...patch } };
    setVocabProgress(next);
    saveJson(STORAGE.vocab, next);
  }

  function recordAnswer(item, correct) {
    recordAnswers([{ item, correct }]);
  }

  function recordAnswers(results) {
    const nextProgress = { ...vocabProgress };
    results.forEach(({ item, correct }) => {
      const current = { ...item, ...(nextProgress[item.id] || {}) };
      nextProgress[item.id] = {
        ...nextProgress[item.id],
        correctCount: (current.correctCount || 0) + (correct ? 1 : 0),
        wrongCount: (current.wrongCount || 0) + (correct ? 0 : 1),
        status: correct ? current.status === 'difficult' ? 'learning' : current.status : 'difficult',
      };
    });
    setVocabProgress(nextProgress);
    saveJson(STORAGE.vocab, nextProgress);
    const correctTotal = results.filter((result) => result.correct).length;
    const nextStats = { correct: stats.correct + correctTotal, total: stats.total + results.length };
    setStats(nextStats);
    saveJson(STORAGE.stats, nextStats);
  }

  function resetWrong(id) {
    updateVocab(id, { wrongCount: 0, status: 'learning' });
  }

  function addImportedKanji(text) {
    const nextItems = Array.from(text)
      .filter((char) => /\p{Script=Han}/u.test(char) && !allKanji.includes(char));
    if (!nextItems.length) return 0;
    const next = [...importedKanji, ...nextItems];
    setImportedKanji(next);
    saveJson(STORAGE.importedKanji, next);
    return nextItems.length;
  }

  function saveKanjiLookup(detail) {
    if (!detail?.kanji) return;
    if (!allKanji.includes(detail.kanji)) {
      const nextKanji = [...importedKanji, detail.kanji];
      setImportedKanji(nextKanji);
      saveJson(STORAGE.importedKanji, nextKanji);
    }
    const nextDetails = { ...kanjiDetails, [detail.kanji]: detail };
    setKanjiDetails(nextDetails);
    saveJson(STORAGE.kanjiDetails, nextDetails);
  }

  function removeImportedKanji(char) {
    const next = importedKanji.filter((item) => item !== char);
    setImportedKanji(next);
    saveJson(STORAGE.importedKanji, next);
    const nextDetails = { ...kanjiDetails };
    delete nextDetails[char];
    setKanjiDetails(nextDetails);
    saveJson(STORAGE.kanjiDetails, nextDetails);
  }

  function saveImportedVocabItems(items) {
    const newItems = items.map((item, index) => ({
      id: item.id || `imp-${Date.now()}-${index}`,
      word: item.word,
      reading: item.reading,
      meaning: item.meaning,
      type: item.type || 'lainnya',
      deck: item.deck || 'Import Manual',
      lesson: item.lesson || 0,
      section: item.section || 'Import Manual',
      status: item.status || 'new',
      wrongCount: item.wrongCount || 0,
      correctCount: item.correctCount || 0,
    })).filter((item) => item.word && item.reading && item.meaning);
    if (!newItems.length) return 0;
    const next = [...imported, ...newItems];
    setImported(next);
    saveJson(STORAGE.imported, next);
    return newItems.length;
  }

  function addImportedVocab(text) {
    const rows = text.split('\n').map((line) => line.trim()).filter(Boolean);
    const newItems = rows.map((line, index) => {
      const [word = '', reading = '', meaning = '', kind = 'lainnya', deckName = 'Import Manual'] = line.split('|').map((part) => part.trim());
      return { id: `imp-${Date.now()}-${index}`, word, reading, meaning, type: kind, deck: deckName || 'Import Manual', lesson: 0, section: 'Import Manual', status: 'new', wrongCount: 0, correctCount: 0 };
    }).filter((item) => item.word && item.reading && item.meaning);
    return saveImportedVocabItems(newItems);
  }

  function removeImportedVocab(id) {
    const next = imported.filter((item) => item.id !== id);
    setImported(next);
    saveJson(STORAGE.imported, next);
  }

  const pageProps = { allKanji, allVocab, decks, updateVocab, recordAnswer, recordAnswers, resetWrong, setPage, imported, setImported, importedKanji, kanjiDetails, addImportedKanji, saveKanjiLookup, removeImportedKanji, addImportedVocab, saveImportedVocabItems, removeImportedVocab, stats, accuracy, difficultCount };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">漢</span>
          <div>
            <strong>Kanji Drill Hub</strong>
            <small>Latihan Jepang harian</small>
          </div>
        </div>
        <nav className="nav-list">
          {navItems.map((item) => (
            <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        {page === 'dashboard' && <Dashboard {...pageProps} totalKanji={allKanji.length} totalVocab={allVocab.length} />}
        {page === 'kanji' && <KanjiBank allKanji={allKanji} kanjiStatus={kanjiStatus} updateKanji={updateKanji} kanjiDetails={kanjiDetails} />}
        {page === 'deck' && <DeckPage {...pageProps} />}
        {page === 'add-data' && <AddDataPage {...pageProps} />}
        {page === 'quiz' && <QuizPage title="Kuis Cepat" instant {...pageProps} />}
        {page === 'kanji-quiz' && <KanjiQuizPage {...pageProps} />}
        {page === 'review' && <ReviewPage {...pageProps} setPage={setPage} />}
        {page === 'review-quiz' && <QuizPage title="Latihan Salah" instant reviewOnly {...pageProps} />}
        {page === 'exam' && <QuizPage title="Exam Mode" instant={false} {...pageProps} />}
      </main>
    </div>
  );
}

function PageHeader({ title, subtitle }) {
  return <header className="page-header"><h1>{title}</h1><p>{subtitle}</p></header>;
}

function Dashboard({ totalKanji, totalVocab, decks, accuracy, difficultCount, setPage }) {
  const cards = [
    ['Total Kanji', totalKanji],
    ['Total Kotoba', totalVocab],
    ['Total Deck', decks.length],
    ['Akurasi', `${accuracy}%`],
    ['Kata Sulit', difficultCount],
  ];
  const actions = [
    ['kanji', 'Kanji Bank', 'Kelola status hafalan kanji'],
    ['deck', 'Deck Kotoba', 'Cari dan baca semua kosakata'],
    ['add-data', 'Tambah Data', 'Masukkan kanji dan kotoba sendiri'],
    ['quiz', 'Kuis Cepat', 'Latihan pilihan ganda langsung'],
    ['kanji-quiz', 'Kuis Kanji', 'Drill arti dan bacaan kanji'],
    ['review', 'Review Salah', 'Ulangi kata yang masih sulit'],
    ['exam', 'Exam Mode', 'Simulasi tanpa jawaban langsung'],
  ];
  return <>
    <PageHeader title="Dashboard" subtitle="Pantau progres dan mulai latihan dari satu tempat." />
    <section className="metric-grid">{cards.map(([label, value]) => <article className="metric-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>
    <section className="action-grid">{actions.map(([id, title, text]) => <button className="action-card" key={id} onClick={() => setPage(id)}><strong>{title}</strong><span>{text}</span></button>)}</section>
  </>;
}

function KanjiBank({ allKanji, kanjiStatus, updateKanji, kanjiDetails }) {
  const [query, setQuery] = useState('');
  const [range, setRange] = useState('Semua');
  const selected = kanjiRanges.find((item) => item.label === range) || kanjiRanges[0];
  const filtered = allKanji.map((char, index) => ({ char, index: index + 1 }))
    .filter((item) => item.index >= selected.min && item.index <= selected.max)
    .filter((item) => item.char.includes(query.trim()));
  return <>
    <PageHeader title="Kanji Bank" subtitle="Cari kanji, pilih rentang, lalu tandai status hafalan." />
    <div className="toolbar"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari kanji" /><select value={range} onChange={(e) => setRange(e.target.value)}>{kanjiRanges.map((item) => <option key={item.label}>{item.label}</option>)}</select></div>
    <section className="kanji-grid">{filtered.map(({ char, index }) => <article className="kanji-card" key={`${char}-${index}`}><span>#{index}</span><strong>{char}</strong>{kanjiDetails[char]?.meaning && <small>{kanjiDetails[char].meaning}</small>}<select value={kanjiStatus[char] || 'new'} onChange={(e) => updateKanji(char, e.target.value)}><option value="new">baru</option><option value="learning">belajar</option><option value="mastered">dikuasai</option></select></article>)}</section>
  </>;
}

function DeckPage({ allVocab, decks }) {
  const [deck, setDeck] = useState('Semua');
  const [type, setType] = useState('Semua');
  const [query, setQuery] = useState('');
  const types = ['Semua', ...new Set(allVocab.map((item) => item.type))];
  const visible = allVocab.filter((item) => (deck === 'Semua' || item.deck === deck) && (type === 'Semua' || item.type === type) && [item.word, item.reading, item.meaning].some((value) => normalize(value).includes(normalize(query))));

  return <>
    <PageHeader title="Deck Kotoba" subtitle="Pelajari kosakata Minna no Nihongo dan data tambahanmu." />
    <div className="toolbar"><select value={deck} onChange={(e) => setDeck(e.target.value)}><option>Semua</option>{decks.map((item) => <option key={item}>{item}</option>)}</select><select value={type} onChange={(e) => setType(e.target.value)}>{types.map((item) => <option key={item}>{item}</option>)}</select><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari kata, bacaan, arti" /></div>
    <section className="table-list">{visible.map((item) => <article className="vocab-row" key={item.id}><div><strong>{item.word}</strong><span>{item.reading}</span></div><p>{item.meaning}</p><span className="badge">{item.type}</span><span className="badge soft">{item.deck}</span></article>)}</section>
  </>;
}

function AddDataPage({ imported, importedKanji, kanjiDetails, addImportedKanji, saveKanjiLookup, removeImportedKanji, addImportedVocab, saveImportedVocabItems, removeImportedVocab }) {
  const [kanjiText, setKanjiText] = useState('');
  const [vocabText, setVocabText] = useState('');
  const [autoVocabQuery, setAutoVocabQuery] = useState('');
  const [autoKanjiQuery, setAutoKanjiQuery] = useState('');
  const [vocabSuggestion, setVocabSuggestion] = useState(null);
  const [kanjiSuggestion, setKanjiSuggestion] = useState(null);
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState('');

  function submitKanji() {
    const total = addImportedKanji(kanjiText);
    setMessage(total ? `${total} kanji baru berhasil ditambahkan.` : 'Tidak ada kanji baru yang bisa ditambahkan.');
    if (total) setKanjiText('');
  }

  function submitVocab() {
    const total = addImportedVocab(vocabText);
    setMessage(total ? `${total} kotoba baru berhasil ditambahkan.` : 'Format kotoba belum lengkap.');
    if (total) setVocabText('');
  }

  async function searchVocabOnline() {
    setLoading('vocab');
    setMessage('');
    try {
      const result = await lookupVocabulary(autoVocabQuery);
      setVocabSuggestion(result);
      setMessage('Kotoba ditemukan. Cek hasilnya sebelum disimpan.');
    } catch (error) {
      setMessage(error.message || 'Pencarian kotoba gagal.');
    } finally {
      setLoading('');
    }
  }

  async function searchKanjiOnline() {
    setLoading('kanji');
    setMessage('');
    try {
      const result = await lookupKanji(autoKanjiQuery);
      setKanjiSuggestion(result);
      setMessage('Kanji ditemukan. Cek hasilnya sebelum disimpan.');
    } catch (error) {
      setMessage(error.message || 'Pencarian kanji gagal.');
    } finally {
      setLoading('');
    }
  }

  function saveSuggestedVocab() {
    const total = saveImportedVocabItems([vocabSuggestion]);
    setMessage(total ? 'Kotoba otomatis berhasil disimpan.' : 'Tidak ada kotoba yang bisa disimpan.');
    if (total) {
      setVocabSuggestion(null);
      setAutoVocabQuery('');
    }
  }

  function saveSuggestedKanji(includeWords = false) {
    saveKanjiLookup(kanjiSuggestion);
    const totalWords = includeWords ? saveImportedVocabItems(kanjiSuggestion.words) : 0;
    setMessage(includeWords ? `Kanji dan ${totalWords} kotoba contoh berhasil disimpan.` : 'Kanji berhasil disimpan.');
    setKanjiSuggestion(null);
    setAutoKanjiQuery('');
  }

  return <>
    <PageHeader title="Tambah Data" subtitle="Tambahkan kotoba atau kanji sendiri untuk dipakai dalam belajar dan kuis." />
    {message && <p className="notice">{message}</p>}
    <section className="add-grid">
      <article className="import-panel featured-panel">
        <h2>Cari Kotoba Otomatis</h2>
        <input value={autoVocabQuery} onChange={(e) => setAutoVocabQuery(e.target.value)} placeholder="Masukkan kata Jepang atau Indonesia" />
        <button className="primary" onClick={searchVocabOnline} disabled={loading === 'vocab'}>{loading === 'vocab' ? 'Mencari...' : 'Cari Online'}</button>
        {vocabSuggestion && <div className="lookup-card"><strong>{vocabSuggestion.word}</strong><span>{vocabSuggestion.reading}</span><p>{vocabSuggestion.meaning}</p><small>{vocabSuggestion.type} | sumber Inggris: {vocabSuggestion.sourceMeaning}</small><button onClick={saveSuggestedVocab}>Simpan Hasil Ini</button></div>}
      </article>
      <article className="import-panel featured-panel">
        <h2>Cari Kanji Otomatis</h2>
        <input value={autoKanjiQuery} onChange={(e) => setAutoKanjiQuery(e.target.value)} placeholder="Masukkan satu kanji, contoh: 水" />
        <button className="primary" onClick={searchKanjiOnline} disabled={loading === 'kanji'}>{loading === 'kanji' ? 'Mencari...' : 'Cari Kanji'}</button>
        {kanjiSuggestion && <div className="lookup-card kanji-lookup"><strong>{kanjiSuggestion.kanji}</strong><p>{kanjiSuggestion.meaning}</p><small>Kun: {kanjiSuggestion.kunReadings.join(', ') || '-'} | On: {kanjiSuggestion.onReadings.join(', ') || '-'} | Goresan: {kanjiSuggestion.strokeCount || '-'}</small><div className="mini-word-list">{kanjiSuggestion.words.slice(0, 4).map((item) => <span key={`${item.word}-${item.reading}`}>{item.word} - {item.meaning}</span>)}</div><button onClick={() => saveSuggestedKanji(false)}>Simpan Kanji</button><button onClick={() => saveSuggestedKanji(true)}>Simpan Kanji + Kotoba</button></div>}
      </article>
      <article className="import-panel">
        <h2>Tambah Kanji</h2>
        <textarea value={kanjiText} onChange={(e) => setKanjiText(e.target.value)} placeholder="例: 旅族短知医者都京" />
        <button className="primary" onClick={submitKanji}>Simpan Kanji</button>
      </article>
      <article className="import-panel">
        <h2>Tambah Kotoba</h2>
        <textarea value={vocabText} onChange={(e) => setVocabText(e.target.value)} placeholder="日本語 | にほんご | bahasa Jepang | kata benda | Deck Saya" />
        <button className="primary" onClick={submitVocab}>Simpan Kotoba</button>
      </article>
    </section>
    <section className="table-list manage-list">
      <h2>Kanji Tambahan</h2>
      {importedKanji.length ? <div className="kanji-grid compact">{importedKanji.map((char) => <article className="kanji-card" key={char}><strong>{char}</strong>{kanjiDetails[char]?.meaning && <small>{kanjiDetails[char].meaning}</small>}<button onClick={() => removeImportedKanji(char)}>Hapus</button></article>)}</div> : <p className="empty">Belum ada kanji tambahan.</p>}
    </section>
    <section className="table-list manage-list">
      <h2>Kotoba Tambahan</h2>
      {imported.length ? imported.map((item) => <article className="vocab-row" key={item.id}><div><strong>{item.word}</strong><span>{item.reading}</span></div><p>{item.meaning}</p><span className="badge soft">{item.deck}</span><button onClick={() => removeImportedVocab(item.id)}>Hapus</button></article>) : <p className="empty">Belum ada kotoba tambahan.</p>}
    </section>
  </>;
}

function QuizPage({ title, instant, allVocab, decks, recordAnswer, recordAnswers, reviewOnly = false }) {
  const [selectedDecks, setSelectedDecks] = useState(decks);
  const [modeId, setModeId] = useState('jp-id');
  const [count, setCount] = useState(10);
  const [session, setSession] = useState(null);
  const mode = quizModes.find((item) => item.id === modeId) || quizModes[0];

  function start() {
    const source = reviewOnly ? allVocab.filter((item) => item.status === 'difficult' || item.wrongCount > 0) : allVocab;
    const pool = source.filter((item) => selectedDecks.includes(item.deck));
    const amount = count === 'all' ? pool.length : Math.min(Number(count), pool.length);
    if (!amount) return;
    const questions = shuffle(pool).slice(0, amount).map((item) => ({ item, options: makeOptions(item, pool, mode), selected: '', checked: false }));
    setSession({ questions, index: 0, correct: 0, finished: false, wrongs: [] });
  }

  function choose(option) {
    if (!session || session.finished) return;
    const q = session.questions[session.index];
    if (q.checked) return;
    const correct = option === q.item[mode.answer];
    const nextQuestions = [...session.questions];
    nextQuestions[session.index] = { ...q, selected: option, checked: true, correct };
    if (instant) recordAnswer(q.item, correct);
    setSession({ ...session, questions: nextQuestions, correct: session.correct + (correct ? 1 : 0), wrongs: correct ? session.wrongs : [...session.wrongs, { ...q.item, selected: option, expected: q.item[mode.answer] }] });
  }

  function next() {
    if (session.index + 1 >= session.questions.length) {
      if (!instant) recordAnswers(session.questions.map((q) => ({ item: q.item, correct: q.selected === q.item[mode.answer] })));
      setSession({ ...session, finished: true });
    } else {
      setSession({ ...session, index: session.index + 1 });
    }
  }

  if (session?.finished) return <Result title={title} session={session} mode={mode} onReset={() => setSession(null)} />;
  if (session) {
    const q = session.questions[session.index];
    const canContinue = q.checked;
    return <>
      <PageHeader title={title} subtitle={`Soal ${session.index + 1} dari ${session.questions.length}`} />
      <section className="quiz-card"><span className="badge">{mode.label}</span><div className="prompt">{q.item[mode.prompt]}</div><div className="option-grid">{q.options.map((option) => <button key={option} className={q.checked ? instant ? option === q.item[mode.answer] ? 'correct' : option === q.selected ? 'wrong' : '' : option === q.selected ? 'selected' : '' : ''} onClick={() => choose(option)}>{option}</button>)}</div>{instant && q.checked && <p className={q.correct ? 'feedback ok' : 'feedback no'}>{q.correct ? 'Benar.' : `Salah. Jawaban: ${q.item[mode.answer]}`}</p>}<button className="primary" disabled={!canContinue} onClick={next}>{session.index + 1 === session.questions.length ? 'Selesai' : 'Soal Berikutnya'}</button></section>
    </>;
  }
  return <Setup title={title} decks={decks} selectedDecks={selectedDecks} setSelectedDecks={setSelectedDecks} modeId={modeId} setModeId={setModeId} count={count} setCount={setCount} start={start} reviewOnly={reviewOnly} />;
}

function Setup({ title, decks, selectedDecks, setSelectedDecks, modeId, setModeId, count, setCount, start, reviewOnly }) {
  function toggle(deck) {
    setSelectedDecks(selectedDecks.includes(deck) ? selectedDecks.filter((item) => item !== deck) : [...selectedDecks, deck]);
  }
  return <>
    <PageHeader title={title} subtitle={reviewOnly ? 'Latihan ini hanya mengambil kata yang pernah salah.' : 'Pilih deck, mode, dan jumlah soal.'} />
    <section className="setup-panel"><h2>Deck</h2><div className="chip-grid">{decks.map((deck) => <label className="check-chip" key={deck}><input type="checkbox" checked={selectedDecks.includes(deck)} onChange={() => toggle(deck)} />{deck}</label>)}</div><h2>Mode</h2><select value={modeId} onChange={(e) => setModeId(e.target.value)}>{quizModes.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}</select><h2>Jumlah Soal</h2><div className="segmented">{counts.map((item) => <button key={item} className={count === item ? 'active' : ''} onClick={() => setCount(item)}>{item === 'all' ? 'semua' : item}</button>)}</div><button className="primary" disabled={!selectedDecks.length} onClick={start}>Mulai Latihan</button></section>
  </>;
}

function Result({ title, session, mode, onReset }) {
  const total = session.questions.length;
  const wrongCount = total - session.correct;
  const accuracy = total ? Math.round((session.correct / total) * 100) : 0;
  return <>
    <PageHeader title={`Hasil ${title}`} subtitle="Ringkasan latihan sudah tersimpan." />
    <section className="metric-grid"><article className="metric-card"><span>Skor</span><strong>{session.correct}/{total}</strong></article><article className="metric-card"><span>Akurasi</span><strong>{accuracy}%</strong></article><article className="metric-card"><span>Benar</span><strong>{session.correct}</strong></article><article className="metric-card"><span>Salah</span><strong>{wrongCount}</strong></article></section>
    <section className="table-list"><h2>Jawaban Salah</h2>{session.wrongs.length ? session.wrongs.map((item) => <article className="vocab-row" key={`${item.id}-${item.selected}`}><div><strong>{item[mode.prompt]}</strong><span>{item.reading}</span></div><p>Jawabanmu: {item.selected || '-'} | Benar: {item.expected}</p><span className="badge">{item.deck}</span></article>) : <p className="empty">Tidak ada jawaban salah.</p>}</section>
    <button className="primary" onClick={onReset}>Latihan Lagi</button>
  </>;
}

function KanjiQuizPage({ allKanji, allVocab, kanjiDetails }) {
  const [mode, setMode] = useState('vocab-meaning');
  const [count, setCount] = useState(10);
  const [session, setSession] = useState(null);

  const kanjiWordPool = allVocab.filter((item) => /\p{Script=Han}/u.test(item.word));
  const kanjiMeaningPool = allKanji
    .filter((char) => kanjiDetails[char]?.meaning)
    .map((char) => ({ id: `kanji-${char}`, kanji: char, meaning: kanjiDetails[char].meaning, reading: [...(kanjiDetails[char].kunReadings || []), ...(kanjiDetails[char].onReadings || [])].join(', ') || '-' }));

  function makeKanjiQuestionPool() {
    if (mode === 'kanji-meaning') {
      return kanjiMeaningPool.map((item) => ({
        prompt: item.kanji,
        answer: item.meaning,
        meta: item.reading,
        options: shuffle([item.meaning, ...shuffle(kanjiMeaningPool.filter((other) => other.id !== item.id).map((other) => other.meaning)).slice(0, 3)]),
      }));
    }

    const answerKey = mode === 'vocab-reading' ? 'reading' : 'meaning';
    return kanjiWordPool.map((item) => ({
      prompt: item.word,
      answer: item[answerKey],
      meta: mode === 'vocab-reading' ? item.meaning : item.reading,
      options: makeOptions(item, kanjiWordPool, { answer: answerKey }),
    }));
  }

  function start() {
    const pool = makeKanjiQuestionPool();
    const amount = count === 'all' ? pool.length : Math.min(Number(count), pool.length);
    if (!amount) return;
    setSession({ questions: shuffle(pool).slice(0, amount).map((item) => ({ ...item, selected: '', checked: false })), index: 0, correct: 0, finished: false, wrongs: [] });
  }

  function choose(option) {
    const q = session.questions[session.index];
    if (q.checked) return;
    const correct = option === q.answer;
    const nextQuestions = [...session.questions];
    nextQuestions[session.index] = { ...q, selected: option, checked: true, correct };
    setSession({ ...session, questions: nextQuestions, correct: session.correct + (correct ? 1 : 0), wrongs: correct ? session.wrongs : [...session.wrongs, { ...q, selected: option }] });
  }

  function next() {
    setSession(session.index + 1 >= session.questions.length ? { ...session, finished: true } : { ...session, index: session.index + 1 });
  }

  if (session?.finished) {
    const total = session.questions.length;
    const accuracy = total ? Math.round((session.correct / total) * 100) : 0;
    return <>
      <PageHeader title="Hasil Kuis Kanji" subtitle="Ringkasan drill kanji cepat." />
      <section className="metric-grid"><article className="metric-card"><span>Skor</span><strong>{session.correct}/{total}</strong></article><article className="metric-card"><span>Akurasi</span><strong>{accuracy}%</strong></article><article className="metric-card"><span>Salah</span><strong>{total - session.correct}</strong></article></section>
      <section className="table-list">{session.wrongs.length ? session.wrongs.map((item) => <article className="vocab-row" key={`${item.prompt}-${item.selected}`}><div><strong>{item.prompt}</strong><span>{item.meta}</span></div><p>Jawabanmu: {item.selected || '-'} | Benar: {item.answer}</p><span className="badge danger">salah</span></article>) : <p className="empty">Tidak ada jawaban salah.</p>}</section>
      <button className="primary" onClick={() => setSession(null)}>Latihan Lagi</button>
    </>;
  }

  if (session) {
    const q = session.questions[session.index];
    return <>
      <PageHeader title="Kuis Kanji" subtitle={`Soal ${session.index + 1} dari ${session.questions.length}`} />
      <section className="quiz-card"><span className="badge">{q.meta}</span><div className="prompt">{q.prompt}</div><div className="option-grid">{q.options.map((option) => <button key={option} className={q.checked ? option === q.answer ? 'correct' : option === q.selected ? 'wrong' : '' : ''} onClick={() => choose(option)}>{option}</button>)}</div>{q.checked && <p className={q.correct ? 'feedback ok' : 'feedback no'}>{q.correct ? 'Benar.' : `Salah. Jawaban: ${q.answer}`}</p>}<button className="primary" disabled={!q.checked} onClick={next}>{session.index + 1 === session.questions.length ? 'Selesai' : 'Soal Berikutnya'}</button></section>
    </>;
  }

  const currentPoolSize = mode === 'kanji-meaning' ? kanjiMeaningPool.length : kanjiWordPool.length;
  return <>
    <PageHeader title="Kuis Kanji" subtitle="Drill cepat untuk arti kanji, bacaan kotoba, dan arti kotoba yang memakai kanji." />
    <section className="setup-panel">
      <h2>Mode Kuis</h2>
      <select value={mode} onChange={(e) => setMode(e.target.value)}>
        <option value="vocab-meaning">Kotoba kanji ke arti Indonesia</option>
        <option value="vocab-reading">Kotoba kanji ke hiragana</option>
        <option value="kanji-meaning">Kanji ke arti Indonesia</option>
      </select>
      <p className="helper-text">{mode === 'kanji-meaning' ? 'Mode arti kanji memakai kanji yang sudah pernah dicari online dan disimpan.' : 'Mode kotoba memakai kosakata yang mengandung kanji, termasuk hasil pencarian online yang disimpan.'}</p>
      <h2>Jumlah Soal</h2>
      <div className="segmented">{counts.map((item) => <button key={item} className={count === item ? 'active' : ''} onClick={() => setCount(item)}>{item === 'all' ? 'semua' : item}</button>)}</div>
      <span className="badge soft">{currentPoolSize} soal tersedia</span>
      <button className="primary" disabled={!currentPoolSize} onClick={start}>Mulai Kuis Kanji</button>
    </section>
  </>;
}

function ReviewPage({ allVocab, resetWrong, setPage }) {
  const difficult = allVocab.filter((item) => item.status === 'difficult' || item.wrongCount > 0);
  return <>
    <PageHeader title="Review Salah" subtitle="Fokus pada kata yang pernah salah atau ditandai sulit." />
    <div className="toolbar"><button className="primary" onClick={() => setPage('review-quiz')} disabled={!difficult.length}>Latih kata salah saja</button><button onClick={() => difficult.forEach((item) => resetWrong(item.id))} disabled={!difficult.length}>Reset salah</button><span className="badge soft">{difficult.length} kata</span></div>
    <section className="table-list">{difficult.length ? difficult.map((item) => <article className="vocab-row" key={item.id}><div><strong>{item.word}</strong><span>{item.reading}</span></div><p>{item.meaning}</p><span className="badge danger">Salah {item.wrongCount}</span><span className="badge soft">{item.deck}</span></article>) : <p className="empty">Belum ada kata salah. Bagus, lanjutkan latihan.</p>}</section>
  </>;
}

export default App;
