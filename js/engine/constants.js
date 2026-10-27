export const START_YEAR = 2026;
export const START_AGE = 15;
export const RETIRE_AGE = 42;

// Bumped whenever new content changes which events can fire or what the RNG
// draws. A career keeps the version it started with (s.setup.cv, missing = 1),
// so careers already in progress replay exactly as they were played.
export const CONTENT_VERSION = 2;

export const SERIES = ['F4', 'F3', 'F2', 'F1'];

// wc   how much the car matters versus the driver in a race (0-1)
// ref  stat level where a choice's odds equal its base chance
// sl   superlicence points by championship position
export const SINFO = {
  F4: { id: 'F4', name: 'Formula 4', lvl: 0, wc: 0.22, skill: [36, 58], age: [15, 16], ref: 44, dnf: 0.03, cost: 350000, prize: [150000, 75000, 40000], sl: [12, 10, 7, 5, 3, 2, 1], sponsor: 120000 },
  F3: { id: 'F3', name: 'Formula 3', lvl: 1, wc: 0.26, skill: [50, 70], age: [16, 19], ref: 56, dnf: 0.035, cost: 1000000, prize: [400000, 200000, 100000], sl: [30, 25, 20, 15, 12, 9, 7, 5, 3, 1], sponsor: 400000 },
  F2: { id: 'F2', name: 'Formula 2', lvl: 2, wc: 0.28, skill: [61, 79], age: [18, 22], ref: 66, dnf: 0.04, cost: 2000000, prize: [1000000, 500000, 250000], sl: [40, 40, 40, 30, 20, 10, 8, 6, 4, 3], sponsor: 1000000 },
  F1: { id: 'F1', name: 'Formula 1', lvl: 3, wc: 0.6, skill: [72, 94], age: [19, 37], ref: 80, dnf: 0.045, cost: 0, prize: [0, 0, 0], sl: [], sponsor: 12000000 },
};

export const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

export const STATS = ['pace', 'racecraft', 'consistency', 'wet', 'composure', 'technical'];

export const STAT_LABEL = {
  pace: 'Pace',
  racecraft: 'Racecraft',
  consistency: 'Consistency',
  wet: 'Wet weather',
  composure: 'Composure',
  technical: 'Technical',
  overall: 'Overall',
};

export const STAT_HINT = {
  pace: 'Raw one-lap speed. Rules qualifying.',
  racecraft: 'Overtaking and defending wheel to wheel.',
  consistency: 'Fewer mistakes, longer tyre life.',
  wet: 'Speed and survival when it rains.',
  composure: 'Handling pressure, media and big moments.',
  technical: 'Feedback that makes the car faster.',
};

export const STYLES = {
  qualifier: { name: 'One-lap wizard', desc: 'Saturday specialist. Pole positions come naturally.', bias: { pace: 8, technical: 2, racecraft: -3 } },
  fighter: { name: 'Wheel-to-wheel fighter', desc: 'Lives for the overtake. Sunday is when it counts.', bias: { racecraft: 8, composure: 2, consistency: -3 } },
  whisperer: { name: 'Tyre whisperer', desc: 'Smooth and clever. Makes a stint last forever.', bias: { consistency: 8, technical: 3, pace: -3 } },
  rain: { name: 'Rainmaster', desc: 'Prays for clouds. Untouchable when it pours.', bias: { wet: 12, composure: 2, pace: -2 } },
};

export const BACKGROUNDS = {
  royalty: {
    name: 'Paddock royalty',
    desc: 'Your dad owns a hedge fund and half a racing team. The money is there. The respect is not.',
    money: 3000000, yearly: 1500000, pot: [70, 87], fame: 15, base: 44, bonus: { composure: 2 }, seat: 'top',
    pros: 'Rich, best junior seat', cons: 'Lower ceiling',
  },
  prodigy: {
    name: 'Karting prodigy',
    desc: 'Three national karting titles and no money at all. Every scout knows your name.',
    money: 120000, yearly: 40000, pot: [79, 94], fame: 8, base: 48, bonus: { racecraft: 2, pace: 2 }, seat: 'mid',
    pros: 'Highest ceiling', cons: 'Broke',
  },
  grafter: {
    name: "Mechanic's kid",
    desc: 'You grew up in a garage and understand a car better than most engineers.',
    money: 40000, yearly: 15000, pot: [75, 91], fame: 2, base: 45, bonus: { technical: 7, consistency: 3 }, seat: 'low',
    pros: 'Technical, tough', cons: 'Starts at the back',
  },
  simracer: {
    name: 'Sim racer',
    desc: 'Found through an esports shootout. Two million followers, no real-world experience.',
    money: 250000, yearly: 150000, pot: [73, 90], fame: 22, base: 44, bonus: { pace: 4, technical: 4, racecraft: -4, composure: -2 }, seat: 'midlow',
    pros: 'Famous, quick', cons: 'Green in traffic',
  },
};

export const TRAINING = {
  sim: { name: 'Simulator grind', desc: 'Hours of laps in the team simulator.', stats: ['pace', 'technical'] },
  craft: { name: 'Race-craft coaching', desc: 'Wheel-to-wheel drills with a former champion.', stats: ['racecraft', 'composure'] },
  fitness: { name: 'Fitness camp', desc: 'Neck, core and cardio until you hate stairs.', stats: ['consistency', 'composure'] },
  wet: { name: 'Wet-weather school', desc: 'Sprinkler-soaked skid pans, every day.', stats: ['wet', 'consistency'] },
};

export const HELMET_COLORS = ['#F2F2F2', '#111827', '#E8002D', '#FF8000', '#FFD23F', '#2FD27A', '#27F4D2', '#3671C6', '#B26BFF', '#FF87BC'];
export const SUPPORTER_COLORS = ['#D4AF37', '#C7CED6'];
