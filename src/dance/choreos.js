// ---------------------------------------------------------------------------
// choreos.js - the three dances, each with its own (original) song.
//
// A dance is a list of PHRASES. A phrase is 8 or 16 moves, one move every
// `every` beats, and lasts 16 beats = 4 bars, so it lines up with the music.
// The last move of every phrase is a GOLD move (double points).
//
// The song is described as data for the synthesiser (audio/Music.js):
//   chords   one chord per bar, looping       [root MIDI note, 'M' | 'm' | '7']
//   bass     8 steps per bar (eighth notes), semitones above the root or null
//   melody   per part: 32 eighth notes = 4 bars of MIDI notes (0 = rest)
//   drums    'disco' | 'funk' | 'pop'
//   parts    the music part played under each phrase
// ---------------------------------------------------------------------------

const INTRO_BEATS = 8;   // 2 bars to get ready (the countdown is the last 4 beats)
const OUTRO_BEATS = 8;   // 2 bars for the final pose and the last chord

function build(phrases) {
  const moves = [];
  let beat = INTRO_BEATS;
  for (const ph of phrases) {
    const every = 16 / ph.length;
    ph.forEach((pose, i) => {
      moves.push({ beat, pose, gold: i === ph.length - 1 });
      beat += every;
    });
  }
  return { moves, totalBeats: beat + OUTRO_BEATS };
}

function choreo(def) {
  const phrases = def.form.map((k) => def.phrases[k]);
  return { ...def, ...build(phrases), introBars: INTRO_BEATS / 4, outroBars: OUTRO_BEATS / 4 };
}

export const CHOREOS = [
  choreo({
    id: 'sugar',
    title: 'SUGAR DISCO',
    difficulty: 1,
    bpm: 108,
    coach: { main: '#ff4fd8', glow: '#ffb3f0' },
    blurb: 'Arms only. Point to the sky, hands on your hips!',
    phrases: {
      A: ['discoR', 'diagR', 'discoR', 'diagR', 'discoL', 'diagL', 'discoL', 'diagL'],
      B: ['up', 'hips', 'tee', 'hips', 'clap', 'hips', 'up', 'vee'],
      C: ['waveR', 'waveL', 'shrug', 'up', 'waveL', 'waveR', 'shrug', 'flex'],
    },
    form: ['A', 'B', 'C', 'A', 'B', 'C'],
    song: {
      drums: 'disco',
      chords: [[57, 'm'], [50, 'm'], [55, 'M'], [48, 'M']],       // Am Dm G C
      bass: [0, 12, 0, 12, 0, 12, 0, 12],
      parts: ['verse', 'chorus', 'chorus', 'verse', 'chorus', 'chorus'],
      melody: {
        verse: [
          69, 0, 0, 72, 0, 0, 76, 0, 74, 0, 0, 72, 0, 0, 69, 0,
          67, 0, 0, 71, 0, 0, 74, 0, 72, 0, 0, 0, 76, 0, 0, 0,
        ],
        chorus: [
          76, 0, 76, 74, 72, 0, 69, 0, 74, 0, 74, 72, 69, 0, 65, 0,
          71, 0, 71, 72, 74, 0, 79, 0, 76, 0, 74, 0, 72, 0, 0, 0,
        ],
      },
      lead: 'square',
    },
  }),
  choreo({
    id: 'robo',
    title: 'ROBO BOOGIE',
    difficulty: 2,
    bpm: 116,
    coach: { main: '#36e0ff', glow: '#b8f4ff' },
    blurb: 'Move like a robot: sharp arms, zig and zag!',
    phrases: {
      A: ['robot', 'zigR', 'robot', 'zigL', 'robot', 'zigR', 'zigL', 'flex'],
      B: ['pointR', 'pointL', 'cross', 'tee', 'pointL', 'pointR', 'cross', 'up'],
      C: ['reachR', 'reachL', 'reachR', 'reachL', 'head', 'hips', 'dabR', 'dabL'],
      D: ['windR', 'windL', 'windR', 'windL', 'clap', 'shrug', 'flex', 'vee'],
    },
    form: ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D'],
    song: {
      drums: 'funk',
      chords: [[53, 'm'], [49, 'M'], [51, 'M'], [48, '7']],       // Fm Db Eb C7
      bass: [0, null, 12, 0, null, 0, 10, 12],
      parts: ['verse', 'chorus', 'verse', 'chorus', 'verse', 'chorus', 'chorus', 'chorus'],
      melody: {
        verse: [
          77, 0, 0, 77, 0, 80, 0, 0, 77, 0, 0, 77, 0, 73, 0, 0,
          75, 0, 0, 75, 0, 79, 0, 0, 76, 0, 0, 79, 0, 0, 0, 0,
        ],
        chorus: [
          72, 77, 80, 77, 72, 77, 80, 84, 73, 77, 80, 77, 73, 77, 80, 85,
          75, 79, 82, 79, 75, 79, 82, 87, 76, 79, 84, 79, 76, 79, 82, 84,
        ],
      },
      lead: 'sawtooth',
    },
  }),
  choreo({
    id: 'star',
    title: 'STARLIGHT POP',
    difficulty: 3,
    bpm: 124,
    coach: { main: '#fff27a', glow: '#fffbd0' },
    blurb: 'Legs too! Kicks, flamingos and a super fast clap part.',
    phrases: {
      A: ['star', 'rest', 'kickR', 'kickL', 'star', 'rest', 'kneeR', 'kneeL'],
      B: ['dabR', 'dabL', 'windR', 'windL', 'discoR', 'diagR', 'discoL', 'diagL'],
      C: ['kneeR', 'pointR', 'kneeL', 'pointL', 'kickR', 'tee', 'kickL', 'vee'],
      D: ['clap', 'up', 'clap', 'up', 'hips', 'head', 'hips', 'up',
        'tee', 'flex', 'tee', 'flex', 'star', 'rest', 'star', 'clap'],
    },
    form: ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D'],
    song: {
      drums: 'pop',
      chords: [[50, 'M'], [45, 'M'], [47, 'm'], [43, 'M']],       // D A Bm G
      bass: [0, 0, 0, 0, 0, 0, 12, 0],
      parts: ['verse', 'chorus', 'verse', 'chorus', 'verse', 'chorus', 'chorus', 'chorus'],
      melody: {
        verse: [
          66, 0, 69, 0, 74, 0, 73, 0, 69, 0, 0, 0, 64, 0, 0, 0,
          71, 0, 69, 0, 66, 0, 69, 0, 67, 0, 0, 0, 0, 0, 0, 0,
        ],
        chorus: [
          78, 0, 78, 0, 76, 78, 81, 0, 76, 0, 76, 0, 73, 76, 78, 0,
          74, 0, 74, 0, 73, 74, 78, 0, 74, 0, 73, 0, 71, 0, 69, 0,
        ],
      },
      lead: 'square',
    },
  }),
];
