// Every decision moment in the game lives here.
//
// phase     prologue | preseason | race | between | offseason
// when      (s, c) => boolean, extra conditions
// w         weight when several events are eligible
// once      only ever happens once per career
// gap       minimum races between repeats (race and between events)
// choices   [{ label, stat, base } or { label, p }] with ok / ko outcomes.
//           Without stat or p a choice always succeeds.
// fx        stats, fame, money, teamRel, flag, ach, asset, injury, academy,
//           training, signFor, salaryUp, extend, carPerf
//           race-only: mod (pace), qmod (qualifying), gain, lose, dnf, saveDnf
// variants  other wordings for events that come up a lot: [{ when, title, text,
//           radio, choices: [{ ok, ko }] }]. Only words: a variant leaves out what
//           it keeps from the event, and never changes choices, odds or effects.
//           Matching variants take turns with the original (see story.js), and
//           events.zh.js has the same list in the same order.
//
// New events that could fire in an existing career, or change what the RNG
// draws, check contentVersion(s) so careers started earlier replay unchanged.

import { pay, firstName, contentVersion } from './helpers.js';
import { TRAINING } from './constants.js';
import { F1_TEAMS } from '../data/teams.js';
import { TRACKS } from '../data/tracks.js';

const L = [];
const ev = (o) => L.push(o);

const F1 = ['F1'];
const JUNIOR = ['F4', 'F3', 'F2'];

// Street, fast or technical circuit. Only ever used to pick words.
const byKind = (c, words) => words[c.kind] ?? words.technical;
const qGap = (c) => (c.f1 ? 'two tenths' : 'a tenth and a half');
const carWord = (c) => (c.rank <= 2 ? 'the class of the field' : c.rank <= 4 ? 'a front-runner' : c.rank <= 7 ? 'firmly midfield' : 'a bit of a handful');
const lapsLeft = (c) => c.laps - c.lap;

// ---------------------------------------------------------------- prologue

ev({
  id: 'pro_kart',
  phase: 'prologue',
  title: 'Age 8: the kart',
  text: (s) =>
    ({
      royalty: "Your father's chauffeur unloads a brand-new kart from a removal van. It has your initials on the seat. It also has a full-time mechanic called Klaus.",
      prodigy: 'Grandad drags a battered 60cc kart out of a neighbour\'s shed. It smells of two-stroke oil and bad decisions. You are in love.',
      grafter: 'Dad builds you a kart from a lawnmower engine and scaffolding pipe. It is held together by cable ties and hope. It is the fastest thing on your street.',
      simracer: "You've done ten thousand laps on a sim rig in your bedroom. Your uncle finally takes you to a real kart track. The seat is hard and the world doesn't have a reset button.",
    })[s.driver.bg],
  choices: [
    { label: 'Every weekend at the local track', ok: { text: 'Rain, cold, snapped chains. You go anyway. By Christmas you know every bump on the circuit.', fx: { stats: { consistency: 3, racecraft: 2 } } } },
    { label: 'Study onboard videos every night', ok: { text: "You learn braking points from grainy videos before you can spell 'apex'.", fx: { stats: { pace: 3, technical: 2 } } } },
    {
      label: 'Race your cousins round the supermarket car park', stat: 'racecraft', base: 55,
      ok: { text: 'Elbows out, wheels banging, nobody hurt. Mostly. You learn more about overtaking in one afternoon than most do in a year.', fx: { stats: { racecraft: 4, composure: 1 } } },
      ko: { text: 'Security escorts you off the premises. You are, briefly, famous on the local news.', fx: { stats: { racecraft: 2 }, fame: 2 } },
    },
  ],
});

ev({
  id: 'pro_final',
  phase: 'prologue',
  title: 'Age 11: the national final',
  text: (s, c) => `Last lap of the national karting final. You're second, a kart's length behind ${c.rival}, the kid everyone calls the next big thing. ${firstName(c.rival)}'s dad is already filming the podium.`,
  choices: [
    {
      label: 'Lunge down the inside at the hairpin', stat: 'racecraft', base: 50,
      ok: { text: (s, c) => `You fire it up the inside, bang wheels on the exit and win by a nose. ${firstName(c.rival)} refuses to shake your hand. A rivalry is born.`, fx: { fame: 3, stats: { racecraft: 2 }, flag: 'kart_champ' } },
      ko: { text: (s, c) => `You lunge, ${firstName(c.rival)} slams the door, and you both end up in the tyre wall. Two dads shout at each other in the paddock. A rivalry is born.`, fx: { stats: { composure: 2 } } },
    },
    {
      label: 'Wait for the slipstream on the final straight', stat: 'pace', base: 45,
      ok: { text: (s, c) => `You pull out of the tow on the line and win by four hundredths. ${firstName(c.rival)} cries. You pretend you don't notice.`, fx: { fame: 3, stats: { pace: 2 }, flag: 'kart_champ' } },
      ko: { text: (s, c) => `Not quite. Second by a bumper. ${firstName(c.rival)} sprays you with fizzy apple juice on the podium.`, fx: { stats: { consistency: 2 } } },
    },
    { label: 'Bring it home in second', ok: { text: (s, c) => `Second place and a trophy taller than you. ${firstName(c.rival)} gives you a smug little wave from the top step. You will remember that wave.`, fx: { stats: { composure: 2 } } } },
  ],
});

const ACADEMY_LINES = {
  rossa: 'You sign in red ink. A million tifosi you have never met now expect miracles.',
  silverline: 'Precise, data-driven, slightly terrifying. They hand you a training plan measured in minutes.',
  torque: 'They pay for everything. They also drop drivers like hot pans. No pressure.',
  papaya: 'Friendly faces, good snacks and a reputation for patience with young drivers.',
};

ev({
  id: 'pro_academy',
  phase: 'prologue',
  title: 'Age 13: the scouts',
  text: 'Two people in team jackets have watched you all weekend. Afterwards they find your family in the paddock. Two Formula 1 junior academies want you, and academies pay for your junior seats.',
  choices: (s, c) => [
    ...c.acads.map((id) => {
      const t = F1_TEAMS.find((x) => x.id === id);
      return { label: `Join the ${t.academy}`, ok: { text: ACADEMY_LINES[id], fx: { academy: id, fame: 2 } } };
    }),
    { label: 'Stay independent', ok: { text: 'No strings and no safety net. Every seat you get from here is yours alone, and so is every bill.', fx: { fame: 1, stats: { composure: 2 }, flag: 'independent' } } },
  ],
});

ev({
  id: 'pro_money',
  phase: 'prologue',
  title: 'Age 14: the money talk',
  text: (s) =>
    s.driver.bg === 'royalty'
      ? "Your father slides a cheque across the dinner table. 'Your mother wants you to be a lawyer. Prove her wrong.'"
      : "A season of car racing costs more than your family's house. Literally. Your parents sit you down at the kitchen table.",
  choices: (s) =>
    s.driver.bg === 'royalty'
      ? [
          { label: 'Take the cheque', ok: { text: 'Two million, signed with a fountain pen. The paddock will never let you forget it.', fx: { money: 2000000 } } },
          { label: 'Turn it down and do it your way', ok: { text: 'Your dad is either furious or proud. With him it is hard to tell.', fx: { stats: { composure: 3 }, fame: 3, flag: 'self_made' } } },
        ]
      : [
          { label: 'Remortgage the house', ok: { text: 'They do it without blinking. You promise yourself you will buy them a better one.', fx: { money: 250000, flag: 'remortgage' } } },
          { label: 'Find a sponsor: the local kebab shop', ok: { text: 'Dönerland Express pays sixty grand to put a spinning kebab on your helmet. Objectively the best-looking helmet in the paddock.', fx: { money: 60000, fame: 2, flag: 'kebab' } } },
          {
            label: 'Talent will be enough', stat: 'composure', base: 50,
            ok: { text: 'A team boss overhears you and offers a scholarship drive. Talent was enough, just about.', fx: { money: 150000, stats: { composure: 2 } } },
            ko: { text: 'It is not enough, yet. You start the season on a shoestring and a lot of pasta.', fx: { stats: { composure: 3 } } },
          },
        ],
});

export const PROLOGUE = ['pro_kart', 'pro_final', 'pro_academy', 'pro_money'];
export const PROLOGUE_AGE = [8, 11, 13, 14];

// --------------------------------------------------------------- preseason

ev({
  id: 'training',
  phase: 'preseason',
  w: 0,
  title: (s, c) => `Winter, ${c.year}`,
  text: (s, c) => `The ${c.seriesName} season starts in a few weeks. How do you spend the winter?`,
  choices: [
    ...Object.entries(TRAINING).map(([key, t]) => ({
      label: t.name,
      hint: t.desc,
      ok: { text: `${t.desc} It hurts, which is how you know it works.`, fx: { training: key, stats: { [t.stats[0]]: 1 } } },
    })),
    { label: 'Rest and see family', ok: { text: 'Home cooking, long walks, no telemetry. You arrive at the first race fresh and annoyingly cheerful.', fx: { training: 'rest', stats: { composure: 1 } } } },
  ],
});

ev({
  id: 'teammate',
  phase: 'preseason',
  w: 0,
  title: 'Meet your teammate',
  text: (s, c) => `${c.tm.name} will be in the other ${c.team} car. The first person you have to beat is the one wearing the same overalls.`,
  choices: [
    { label: 'Be friendly and share data', ok: { text: (s, c) => `You swap setups and go for dinner. ${firstName(c.tm.name)} turns out to be decent company. The team loves it.`, fx: { teamRel: 4, stats: { technical: 1 } } } },
    {
      label: 'Start the mind games early', stat: 'composure', base: 50,
      ok: { text: (s, c) => `A few well-timed comments to the press and a very cold handshake. ${firstName(c.tm.name)} looks rattled before a wheel has turned.`, fx: { fame: 2, stats: { composure: 1 }, flag: 'mindgames' } },
      ko: { text: (s, c) => `Your mind games leak to the press and you look petty. ${firstName(c.tm.name)} looks like the grown-up.`, fx: { teamRel: -5, fame: 1 } },
    },
    { label: 'Keep your head down', ok: { text: 'You focus on yourself. Quiet, polite and impossible to read.', fx: { stats: { consistency: 1 } } } },
  ],
  variants: [
    {
      when: (s, c) => c.tm.ovr >= c.ovr + 3,
      title: 'A benchmark next door',
      text: (s, c) => `${c.tm.name} will be in the other ${c.team} car, and everyone who matters rates ${firstName(c.tm.name)} above you, including your own engineers. Beat that and the world notices.`,
      choices: [
        { ok: (s, c) => `You ask ${firstName(c.tm.name)} to talk you through their data, and they actually do. You learn a lot. The team loves it.` },
        {
          ok: (s, c) => `You tell the press you are "not here to be anyone's number two". ${firstName(c.tm.name)} reads it and looks unsettled.`,
          ko: (s, c) => `Picking a fight with the faster driver looks desperate. ${firstName(c.tm.name)} just smiles.`,
        },
        { ok: 'You say little, watch everything and get on with it.' },
      ],
    },
    {
      when: (s, c) => c.tm.ovr <= c.ovr - 3,
      text: (s, c) => `${c.team} have paired you with ${c.tm.name}. The press has already decided you are the team leader. Nobody has told ${firstName(c.tm.name)}.`,
      choices: [
        { ok: (s, c) => `You share everything with ${firstName(c.tm.name)} and the whole garage pulls in the same direction. The team loves it.` },
        {
          ok: (s, c) => `A quiet word, a confident grin, and ${firstName(c.tm.name)} understands the pecking order before testing starts.`,
          ko: (s, c) => `Throwing your weight around goes down badly. ${firstName(c.tm.name)} comes out of it looking like the grown-up.`,
        },
        { ok: 'You let the lap times do the talking.' },
      ],
    },
    {
      title: 'Seat fitting',
      text: (s, c) => `Seat fittings at the ${c.team} factory. In the next room, ${c.tm.name} is being fitted for the other car. You have both been told to "push each other".`,
      choices: [
        { ok: (s, c) => `You knock on the door and suggest sharing setups. ${firstName(c.tm.name)} says yes. The engineers can't believe their luck.` },
        {
          ok: (s, c) => `You ask for your seat to be made "a bit faster than the other one", loudly enough to be heard next door. ${firstName(c.tm.name)} doesn't laugh.`,
          ko: (s, c) => `Your joke about the other seat gets back to ${firstName(c.tm.name)} and sounds a lot worse second-hand.`,
        },
        { ok: 'You get fitted, say thank you and go home. Nobody learns anything about you.' },
      ],
    },
  ],
});

ev({
  id: 'car_launch',
  phase: 'preseason',
  series: F1,
  w: 0,
  title: (s, c) => `${c.team} launch, ${c.year}`,
  text: (s, c) =>
    `The new ${c.team} rolls out under the lights and a DJ nobody asked for. Early whispers from testing say it's ${
      c.rank <= 2 ? 'the class of the field' : c.rank <= 4 ? 'a front-runner' : c.rank <= 7 ? 'firmly midfield' : 'a bit of a handful'
    }.`,
  choices: (s, c) => [
    { label: 'Hype it up for the cameras', ok: { text: '"Best car I have ever driven." Marketing are thrilled. Your engineer raises an eyebrow.', fx: { fame: 1, teamRel: 2 } } },
    { label: 'Manage expectations', ok: { text: '"We\'ll see where we are in Melbourne." The most F1 sentence ever spoken.', fx: { stats: { composure: 1 } } } },
    ...(c.rank > 6 ? [{ label: 'Tell the truth', ok: { text: '"It\'s a bit of a pig, honestly." The quote goes everywhere. Fans love your honesty. The team does not.', fx: { fame: 3, teamRel: -4 } } }] : []),
  ],
  variants: [
    {
      when: (s, c) => c.rank <= 3,
      text: (s, c) => `Three hundred journalists, one covered car, and a rumour from the wind tunnel that the new ${c.team} is ${carWord(c)}. The cover comes off to gasps.`,
      choices: [
        { ok: '"It\'s a rocket." Every rival team principal quotes you at their own launch.' },
        { ok: '"Let\'s see after the first few races." Your team principal nods. Nobody believes you.' },
        { ok: '"Honestly? It\'s a handful." The team does not enjoy that quote.' },
      ],
    },
    {
      when: (s, c) => c.rank > 6,
      text: (s, c) => `The ${c.team} launch is held in a car park, because the budget went on the car. Testing whispers that it is ${carWord(c)}.`,
      choices: [
        { ok: '"A big step forward." Marketing prints it on a banner. Your engineer quietly takes the banner down.' },
        { ok: '"We have work to do." Nobody argues.' },
        { ok: '"It\'s slow in the corners and slow on the straights." Fans love the honesty. The team does not.' },
      ],
    },
    {
      title: (s, c) => `${c.year}: the new ${c.team}`,
      text: (s, c) => `The new ${c.team} is unveiled on a livestream with a countdown clock and a smoke machine that sets off the fire alarm. Testing says it is ${carWord(c)}.`,
      choices: [
        { ok: '"It already feels special." The clip goes everywhere. Your engineer coughs.' },
        { ok: '"Ask me after the first race." Wise, if dull.' },
        { ok: '"It isn\'t very good." The fire alarm was less awkward.' },
      ],
    },
  ],
});

// --------------------------------------------------------- race: forced ones

ev({
  id: 'first_race',
  phase: 'race',
  w: 0,
  once: true,
  title: (s, c) => `${c.track}: your first car race`,
  text: 'The car is bigger, faster and fussier than any kart. Twenty other teenagers want exactly what you want. Your hands are shaking on the steering wheel.',
  choices: [
    {
      label: 'Attack from lap one', stat: 'racecraft', base: 50,
      ok: { text: 'You make three passes before the first corner and grin so hard your visor fogs up.', fx: { mod: 2, fame: 1 } },
      ko: { text: 'Too eager. You touch wheels at Turn 1 and spend the race fighting at the back.', fx: { mod: -3, stats: { composure: 1 } } },
    },
    { label: 'Learn, finish, collect data', ok: { text: 'You bring it home in one piece and learn more in one race than in a month of testing.', fx: { mod: 0.5, stats: { consistency: 1, technical: 1 } } } },
  ],
});

ev({
  id: 'debut_f1',
  phase: 'race',
  w: 0,
  once: true,
  title: (s, c) => `${c.track}: your Formula 1 debut`,
  text: (s) =>
    `Grid walk. A pop star asks who you are. A camera is shoved into your face. ${s.flags.remortgage ? 'Your parents, who remortgaged the house for this, are crying in the garage.' : 'Your family is crying in the garage.'} ${s.flags.kebab ? 'Somewhere, the owner of Dönerland Express is watching on a tiny TV above the rotisserie.' : ''}`,
  choices: [
    {
      label: 'Soak it all in', stat: 'composure', base: 50,
      ok: { text: 'You take a breath, look up at the grandstands and smile. Then you drive like you belong.', fx: { mod: 1.5, fame: 3 } },
      ko: { text: 'It is all too much. You stall on the grid. Not ideal.', fx: { mod: -2.5, fame: 2 } },
    },
    { label: 'Headphones on, visor down', ok: { text: 'You shut the world out. Just another race, just with eleven times the TV audience.', fx: { mod: 0.5, stats: { composure: 1 } } } },
  ],
});

ev({
  id: 'title_decider',
  phase: 'race',
  w: 0,
  title: (s, c) => `${c.track}: the decider`,
  text: (s, c) =>
    c.title.lead
      ? `Final round. You lead ${c.title.opp} by ${c.title.gap} points. Finish ahead of ${firstName(c.title.opp)} and you are world champion.`
      : `Final round. You are ${c.title.gap} points behind ${c.title.opp}. You need to win and hope.`,
  choices: (s, c) => [
    {
      label: 'All in. Go for the win', stat: 'racecraft', base: 50,
      ok: { text: 'You drive the race of your life. Every lap a qualifying lap, every overtake perfect.', fx: { mod: 4, fame: 3 } },
      ko: { text: 'You push too hard and run wide early. The mountain just got steeper.', fx: { mod: -3 } },
    },
    {
      label: c.title.lead ? 'Play the percentages' : 'Stay calm, let it come to you', stat: 'consistency', base: 58,
      ok: { text: 'Measured, mature, error-free. Exactly what the moment needs.', fx: { mod: 1.5 } },
      ko: { text: 'Too cautious. You lose a place at the start and spend the race catching up.', fx: { mod: -1.5 } },
    },
  ],
});

// --------------------------------------------------- race: failure rescue

ev({
  id: 'mech_issue',
  phase: 'race',
  when: (s, c) => c.pdnf && c.pdnfWhy === 'mech',
  dnfOnly: true,
  title: (s, c) => `${c.track}: lap ${c.lap}`,
  radio: (s, c) => `${c.eng}: "We're seeing a temperature spike. Manage it, manage it."`,
  text: 'Something smells hot, and it is not the brakes. The dash is lighting up like a Christmas tree.',
  choices: [
    {
      label: 'Lift and coast, short-shift everything', stat: 'technical', base: 50,
      ok: { text: 'You drive like a hypermiler and nurse it to the flag. Your engineer calls it the best slow driving he has ever seen.', fx: { saveDnf: true, mod: -1, teamRel: 2 } },
      ko: { text: 'The engine gives up in a cloud of very expensive smoke.', fx: {} },
    },
    {
      label: 'Ignore it and keep pushing', p: 25,
      ok: { text: 'It holds! Nobody in the garage can explain why.', fx: { saveDnf: true, fame: 1 } },
      ko: { text: "Bang. You're parked on the grass watching marshals run towards a fire you started.", fx: {} },
    },
    { label: 'Park it and save the engine', ok: { text: 'You pull into the garage. The mechanics nod. The engine lives to fight another day.', fx: { teamRel: 3 } } },
  ],
  variants: [
    {
      radio: (s, c) => `${c.eng}: "We're losing hydraulic pressure. Short-shift and stay off the kerbs."`,
      text: 'The gearshifts are getting lazy and the steering is getting heavy. Somewhere behind you, a hydraulic line is weeping.',
      choices: [
        { ok: 'You baby every shift and stay off every kerb. The pressure holds to the flag. Just.', ko: 'The gearbox jams in fourth and the car rolls to a stop. The hydraulics win.' },
        { ok: 'The warning light stays on and the car keeps going anyway. Nobody can explain it.', ko: 'Fluid everywhere, gears nowhere. You park it with smoke curling from the back.' },
        { ok: 'You bring it in before anything else breaks. The gearbox will live to race again.' },
      ],
    },
    {
      when: (s, c) => c.kind !== 'fast',
      radio: (s, c) => `${c.eng}: "Rear brake temperatures are critical. Lift and coast, please."`,
      text: (s, c) => `The brakes are glowing orange on the onboard camera and the pedal gets longer with every stop. ${c.kind === 'street' ? 'Between these walls, that is not a comforting thought.' : 'There are a lot of slow corners left.'}`,
      choices: [
        { ok: 'You lift early for every braking zone and the temperatures come back from the edge. Slow, but home.', ko: 'The pedal goes to the floor at the end of the straight. Escape road, then the garage.' },
        { ok: 'You keep braking late and the discs somehow survive. The engineers want to frame them.', ko: 'A brake disc explodes in a shower of sparks. You limp back to the pits and climb out.' },
        { ok: 'You park it before the brakes give up for good. Sensible, and the team says so.' },
      ],
    },
    {
      radio: (s, c) => `${c.eng}: "Fuel pressure is dropping. Keep it smooth, stay off the kerbs."`,
      text: 'The engine coughs on every corner exit and the car stutters down the straights. Something in the fuel system is very unhappy.',
      choices: [
        { ok: 'Smooth, gentle and boring, and it gets you to the flag.', ko: 'One last cough on the back straight and the engine falls silent.' },
        { ok: 'It stutters, it splutters, it finishes. Nobody in the garage can explain why.', ko: 'You keep your foot in and the engine coughs itself to death.' },
        { ok: 'You bring it in. Better a quiet retirement today than a new engine tomorrow.' },
      ],
    },
  ],
});

ev({
  id: 'crash_moment',
  phase: 'race',
  when: (s, c) => c.pdnf && c.pdnfWhy === 'crash',
  dnfOnly: true,
  title: (s, c) => `${c.track}: lap ${c.lap}`,
  text: (s, c) => `${c.wet ? 'On a wet kerb' : 'Over a bump'} the rear steps out at a hundred and seventy miles an hour. You have about a quarter of a second.`,
  choices: [
    {
      label: 'Catch it with opposite lock', stat: 'consistency', base: 45,
      ok: { text: 'Snap, catch, snap again. You keep it out of the wall. Your heart rate will come down sometime next week.', fx: { saveDnf: true, mod: -1.5, fame: 1 } },
      ko: { text: "Into the barrier. You're fine. The car is modern art.", fx: { teamRel: -2 } },
    },
    {
      label: 'Both feet in and ride it out', stat: 'composure', base: 45,
      ok: { text: 'You spin, stop facing the right way, and rejoin. Lucky, but luck counts.', fx: { saveDnf: true, mod: -3 } },
      ko: { text: 'You spin straight into the gravel and beach it. Race over.', fx: {} },
    },
  ],
});

// ------------------------------------------------------------ race: common

ev({
  id: 'turn_one',
  phase: 'race',
  w: 3,
  gap: 5,
  when: (s, c) => c.grid >= 2,
  title: (s, c) => `${c.track}: lap 1, Turn 1`,
  text: (s, c) => `Five lights. Gone. A decent launch from P${c.grid}, and the field funnels into Turn 1 like a stadium exit after the final whistle.`,
  choices: [
    {
      label: 'Around the outside', stat: 'racecraft', base: 50,
      ok: { text: 'You hang it round the outside and, miraculously, everybody leaves you a car-width. Two places gained.', fx: { mod: 2.5 } },
      ko: { text: 'Squeezed onto the kerb, then the grass. You rejoin with a bent ego and lose places.', fx: { mod: -2 } },
    },
    {
      label: 'Dive down the inside', stat: 'racecraft', base: 38,
      ok: { text: 'Late, deep and somehow legal. The three cars behind you are still swearing.', fx: { mod: 4, fame: 1 } },
      ko: { text: 'You arrive at the apex at the same time as two other cars. Front wing everywhere.', fx: { mod: -4.5, fame: -1 } },
    },
    { label: 'Stay tidy and survive', ok: { text: 'Others play bumper cars. You keep your nose clean. Patience is a skill too.', fx: { mod: 0.5 } } },
  ],
  variants: [
    {
      title: (s, c) => `${c.track}: the start`,
      text: (s, c) =>
        byKind(c, {
          street: `Lights out from P${c.grid} on the streets of ${c.place}. Turn 1 is a right-hander between two concrete walls, and twenty cars want to be first through it.`,
          fast: `Lights out from P${c.grid}. It is a long drag down to Turn 1, slipstreams everywhere, and by the braking zone the cars are four abreast.`,
          technical: `Lights out from P${c.grid}. Turn 1 is tight and slow, the kind of corner where somebody always arrives too fast.`,
        }),
      choices: [
        { ok: 'You take the long way round and the cars on the inside tangle with each other. Two places, gift-wrapped.', ko: 'There is no room on the outside after all. Kerb, grass, and a handful of places gone.' },
        { ok: 'You brake later than anyone thought possible and stop the car on the apex. Through.', ko: 'You arrive at the apex with company. Front wing in pieces, and a long first lap.' },
        { ok: 'You hang back, pick your way through the chaos and leave Turn 1 with your car in one piece.' },
      ],
    },
    {
      when: (s, c) => c.wet,
      title: (s, c) => `${c.track}: lap 1 in the spray`,
      text: (s, c) => `A wet start from P${c.grid}. Nobody can see past the car in front, and Turn 1 is somewhere behind a wall of spray.`,
      choices: [
        { ok: 'You go round the outside where the grip is, and two cars aquaplane past their braking points. Two places.', ko: 'The outside line is a river. You slither wide and cars pour past in the spray.' },
        { ok: 'You dive blind into the spray on the inside and come out with clear track ahead. Heroic, or lucky.', ko: "You brake where you think the braking zone is. It isn't. Front wing, someone's rear tyre, a lot of places." },
        { ok: 'You keep it on the black line and let the brave and the foolish sort themselves out.' },
      ],
    },
    {
      title: (s, c) => `${c.track}: lights out`,
      text: (s, c) =>
        c.grid <= 5
          ? `Lights out. You launch from P${c.grid} with the leaders right there, and the run to Turn 1 is a game of chicken at two hundred kilometres an hour.`
          : `Lights out. From P${c.grid} it is a wall of rear wings and brake dust, and every gap into Turn 1 closes as soon as you look at it.`,
      choices: [
        { ok: 'You commit round the outside and hold your nerve while the others flinch. Two places.', ko: 'The gap closes, you lift, and the cars behind take the invitation.' },
        { ok: 'A late, cheeky dive, and the door is still open when you get there. Big gain.', ko: 'You and the car ahead want the same piece of tarmac. Carbon-fibre confetti.' },
        { ok: 'You keep it tidy, stay out of trouble and let the first lap come to you.' },
      ],
    },
  ],
});

ev({
  id: 'safety_car',
  phase: 'race',
  banner: 'sc',
  w: (s, c) => (c.sc ? 4 : 1.5),
  gap: 4,
  title: (s, c) => `${c.track}: safety car`,
  radio: (s, c) => `${c.eng}: "Safety car, safety car. Box or stay out? Your call."`,
  text: 'Debris everywhere. Half the field dives into the pits and your engineer needs an answer in about four seconds.',
  choices: [
    {
      label: 'Box for fresh tyres', stat: 'technical', base: 55,
      ok: { text: 'Perfect stop, fresh rubber, and you scythe through the field on the restart.', fx: { mod: 2.5 } },
      ko: { text: 'You get stacked behind your teammate in the pit lane. Double-stack disaster.', fx: { mod: -1.5 } },
    },
    {
      label: 'Stay out for track position', stat: 'consistency', base: 55,
      ok: { text: 'You hold your place on old tyres with a masterclass in defending.', fx: { mod: 2 } },
      ko: { text: 'With ten laps left the tyres give up. Everyone on fresh rubber waves as they go past.', fx: { mod: -2.5 } },
    },
  ],
  variants: [
    {
      text: (s, c) =>
        byKind(c, {
          street: 'Someone has found the wall. The crane is coming out, the safety car is already out, and the pit entry is the next corner.',
          fast: 'A car is beached in the gravel at the fastest corner on the lap. Safety car. A stop costs far less time than usual, and every pit wall knows it.',
          technical: 'A spin in the twisty middle sector leaves a car stranded across the track. Safety car. Track position is gold here, but so are fresh tyres.',
        }),
      choices: [
        { ok: 'Quick stop, fresh tyres, and you pick them off one by one on the restart.', ko: 'Everyone had the same idea. You queue in the pit lane and rejoin behind cars you were beating.' },
        { ok: 'You stay out, back the field up at the restart, and nobody gets a look.', ko: 'The old tyres last until ten laps from home, then the cars that stopped come by one after another.' },
      ],
    },
    {
      when: (s, c) => c.wet,
      radio: (s, c) => `${c.eng}: "Safety car. Fresh tyres are ready if you want them."`,
      text: 'A car has aquaplaned into the barrier and there is standing water on the straight. Safety car, and the spray hangs over the pit entry like fog.',
      choices: [
        { ok: 'Fresh tyres with proper tread. On the restart you have grip that nobody around you can find.', ko: 'You stop, the rain eases, and your shiny new tyres are suddenly the wrong ones.' },
        { ok: 'You stay out and keep your track position. In the spray, nobody can get close enough to pass.', ko: 'Your worn tyres skate across every puddle on the restart. Places fall away.' },
      ],
    },
    {
      title: (s, c) => `${c.track}: yellow flags`,
      radio: (s, c) => `${c.eng}: "SC, SC. Pit entry is open. Talk to me."`,
      text: (s, c) => `Yellow flags, then the safety car boards. ${c.pos <= 3 ? 'You are near the front, so whatever you do, the cars behind will do the opposite.' : 'The cars around you are already weaving towards the pit entry.'}`,
      choices: [
        { ok: 'In and out without a fumble. Your fresh rubber does the talking on the restart.', ko: 'A slow stop and a queue behind another car. You rejoin in traffic.' },
        { ok: 'You hold position and nail the restart. The gamble pays.', ko: 'Cold, old tyres on the restart and no grip at all. You slide backwards through the order.' },
      ],
    },
  ],
});

ev({
  id: 'rain_call',
  phase: 'race',
  banner: 'rain',
  w: (s, c) => (c.wet ? 5 : 0.6),
  gap: 4,
  title: (s, c) => `${c.track}: rain`,
  text: (s, c) => `The sky over ${c.place} turns the colour of a bruise. First drops on the visor. Whatever you decide now is worth places.`,
  choices: [
    {
      label: 'Box now for intermediates', stat: 'wet', base: 55,
      ok: { text: 'You pit a lap before everyone else and gain a fortune.', fx: { mod: 3 } },
      ko: { text: 'The shower passes. You are on inters on a drying track, cooking them like sausages.', fx: { mod: -2 } },
    },
    {
      label: 'One more lap on slicks', stat: 'wet', base: 40,
      ok: { text: 'A hero lap on slicks in the wet. The commentators lose their voices.', fx: { mod: 5, fame: 2 } },
      ko: { text: 'Aquaplaning, gravel, a very long lap back to the pits. Still running, just last.', fx: { mod: -6 } },
    },
    { label: 'Do what the team says', ok: { text: 'You follow the call. Sensible, unspectacular, appreciated.', fx: { mod: 0.5, teamRel: 2 } } },
  ],
});

ev({
  id: 'last_lap',
  phase: 'race',
  w: 3,
  gap: 4,
  when: (s, c) => c.pos >= 2 && c.pos <= 12 && c.ahead,
  title: (s, c) => `${c.track}: final lap`,
  text: (s, c) => `Last lap. You are glued to the gearbox of ${c.ahead.name} for P${c.pos - 1}.`,
  choices: (s, c) => [
    {
      label: 'Send it into the last braking zone', stat: 'racecraft', base: 42,
      ok: { text: `Late on the brakes, half a car alongside, and it sticks. P${c.pos - 1}!`, fx: { gain: 1, fame: 1 } },
      ko: { text: `You lock up, run wide, and ${c.behind ? c.behind.last : 'the car behind'} sneaks through as well.`, fx: { lose: 1 } },
    },
    {
      label: 'Use the slipstream on the straight', stat: 'pace', base: 48,
      ok: { text: `Tow perfect, you pull out and breeze past ${c.ahead.last} before the line.`, fx: { gain: 1 } },
      ko: { text: 'Not quite enough. Half a car behind at the flag.', fx: {} },
    },
    { label: 'Bring it home', ok: { text: 'You take the points. Your engineer exhales on the radio.', fx: {} } },
  ],
  variants: [
    {
      title: (s, c) => `${c.track}: last lap`,
      text: (s, c) =>
        byKind(c, {
          street: `Last lap around ${c.place}. ${c.ahead.name} is half a second ahead for P${c.pos - 1}, and there is exactly one place to pass.`,
          fast: `Last lap. ${c.ahead.name} is a sitting duck on the long straight, if you can stay close enough through the fast stuff. P${c.pos - 1} is right there.`,
          technical: `Last lap, nose to tail with ${c.ahead.name} through the twisty stuff for P${c.pos - 1}. Nail the exit of the final corner or forget it.`,
        }),
      choices: (s, c) => [
        { ok: `You throw it up the inside at the last braking zone and it sticks. P${c.pos - 1}!`, ko: `You lock the fronts, run wide, and ${c.behind ? c.behind.last : 'the car behind'} sneaks through as well.` },
        { ok: `Perfect exit, perfect tow. You pull out and beat ${c.ahead.last} to the line.`, ko: 'You get the tow but run out of road. Half a car short at the flag.' },
        { ok: 'You bring it home. Your engineer finally breathes out.' },
      ],
    },
    {
      when: (s, c) => c.last,
      title: (s, c) => `${c.track}: last lap of the season`,
      text: (s, c) => `The last lap of the last race of the year. ${c.ahead.name} for P${c.pos - 1}, and the whole winter to think about whatever happens next.`,
      choices: (s, c) => [
        { ok: `A lunge into the final braking zone and it sticks. P${c.pos - 1}, and a winter of smiling.`, ko: `You lock up and run wide, and ${c.behind ? c.behind.last : 'the car behind'} slips through as well. It will be a long winter.` },
        { ok: `One last tow, one last pass. You beat ${c.ahead.last} to the line and end the year on a high.`, ko: 'Half a car short at the flag. The season ends with you staring at a gearbox.' },
        { ok: 'You bring it home and end the season in one piece. The mechanics are already packing the garage.' },
      ],
    },
    {
      text: (s, c) => `Final lap. ${c.ahead.name} has been defending for half the race and those tyres are cooked. P${c.pos - 1} is half a second away.`,
      choices: (s, c) => [
        { ok: `Late, later, latest. You out-brake ${c.ahead.last} into the last big stop and the place is yours.`, ko: `You brake too late, the fronts lock, and ${c.behind ? c.behind.last : 'the car behind'} takes a place off you too.` },
        { ok: `You hang on through the last corner, get the tow and pip ${c.ahead.last} on the line.`, ko: 'Close, but not close enough. Half a car at the flag.' },
        { ok: 'No heroics. You bring it home and bank the result.' },
      ],
    },
  ],
});

ev({
  id: 'defend',
  phase: 'race',
  w: 3,
  gap: 4,
  when: (s, c) => c.pos <= 10 && c.behind,
  title: (s, c) => `${c.track}: under pressure`,
  text: (s, c) => `${c.behind.name} has fresher tyres and fills your mirrors. P${c.pos} is on the line.`,
  choices: (s, c) => [
    {
      label: 'Cover the inside, one move only', stat: 'racecraft', base: 55,
      ok: { text: `Textbook. ${c.behind.last} tries both sides and gets neither.`, fx: {} },
      ko: { text: `${c.behind.last} fakes left, goes right. Gone.`, fx: { lose: 1 } },
    },
    {
      label: 'Late move under braking', stat: 'racecraft', base: 62,
      ok: { text: 'Hard, borderline, effective. The stewards note it and take no action.', fx: { fame: 1 } },
      ko: { text: 'Five-second penalty for moving under braking. That stings.', fx: { lose: 3, fame: -1 } },
    },
    {
      label: 'Let him by and save your tyres', stat: 'consistency', base: 52,
      ok: { text: `You let ${c.behind.last} go, then re-pass on fresher rubber three laps from home.`, fx: {} },
      ko: { text: `You let ${c.behind.last} go. ${c.behind.last} keeps going.`, fx: { lose: 1 } },
    },
  ],
  variants: [
    {
      text: (s, c) =>
        byKind(c, {
          street: `${c.behind.name} is all over your gearbox between the walls of ${c.place}. There is one place to pass on this lap, and you both know where it is. P${c.pos} is on the line.`,
          fast: `${c.behind.name} is in your slipstream on every straight and closer every lap. P${c.pos} will be decided at the end of the long straight.`,
          technical: `${c.behind.name} is glued to your rear wing through the twisty stuff, looking for a better exit and a gap that isn't there yet. P${c.pos} is on the line.`,
        }),
      choices: (s, c) => [
        { ok: `${c.behind.last} looks left, looks right, and finds a closed door every time.`, ko: `${c.behind.last} gets the better exit and drives straight past.` },
        { ok: `A late, firm move. ${c.behind.last} backs out of it. The stewards look, then look away.`, ko: 'The stewards were watching. Five seconds for moving under braking.' },
        { ok: `You wave ${c.behind.last} through, tuck in behind, and take the place back on fresher tyres near the end.`, ko: `You let ${c.behind.last} through. That is the last you see of the car.` },
      ],
    },
    {
      when: (s, c) => c.tmBehind,
      title: (s, c) => `${c.track}: teammate in the mirrors`,
      text: (s, c) => `It's your own teammate. ${c.tm.name} has fresher tyres, P${c.pos} is on the line, and the pit wall has gone very quiet.`,
      choices: (s, c) => [
        { ok: `Hard and fair. ${c.tm.last} has nowhere to go, and the team gets to breathe again.`, ko: `${c.tm.last} dives up the inside and makes it stick. The garage claps, very quietly.` },
        { ok: `A late move on your own teammate. ${c.tm.last} backs out, and the team principal pretends not to have seen it.`, ko: 'Five seconds for moving under braking, against your own teammate. Ouch.' },
        { ok: `You let ${c.tm.last} by, then take the place back on fresher rubber three laps from home.`, ko: `You let ${c.tm.last} by. ${c.tm.last} keeps going.` },
      ],
    },
    {
      when: (s, c) => c.wet,
      title: (s, c) => `${c.track}: pressure in the spray`,
      text: (s, c) => `Somewhere in the spray behind you is ${c.behind.name}, filling your mirrors whenever you can see them. P${c.pos} is on the line.`,
      choices: (s, c) => [
        { ok: `${c.behind.last} looks for a way through the spray and finds you on the racing line every time.`, ko: `${c.behind.last} goes round the outside in the wet. You never saw it coming, mostly because you never saw anything.` },
        { ok: `A late move in the spray. ${c.behind.last} backs off. The stewards put it down to the conditions.`, ko: 'Moving under braking in the wet. The stewards are not amused: five seconds.' },
        { ok: `You let ${c.behind.last} through, then pounce when the car aquaplanes two laps later.`, ko: `You let ${c.behind.last} through and the spray swallows the car. Gone.` },
      ],
    },
    {
      title: (s, c) => `${c.track}: holding on`,
      text: (s, c) => `Five laps to go. ${c.behind.name} has shown a nose at three corners in a row, and your tyres are finished. P${c.pos} is hanging by a thread.`,
      choices: (s, c) => [
        { ok: 'Defensive line, every corner, every lap. You make the car as wide as a bus.', ko: `${c.behind.last} feints, you flinch, and that is that.` },
        { ok: `You leave it late and firm, and ${c.behind.last} decides that today is not the day.`, ko: 'One move too many under braking. The stewards hand you five seconds.' },
        { ok: `You let ${c.behind.last} go, save what is left of the tyres, and pounce on the last lap.`, ko: `You let ${c.behind.last} go. Your tyres were never coming back.` },
      ],
    },
  ],
});

ev({
  id: 'team_orders_let',
  phase: 'race',
  w: 4,
  gap: 8,
  when: (s, c) => c.tmBehind,
  title: (s, c) => `${c.track}: team orders`,
  radio: (s, c) => `${c.eng}: "${c.tm.last} is faster. Let him through, please."`,
  text: 'Your teammate is right behind you and the pit wall has made its decision.',
  choices: [
    { label: 'Obey the order', ok: { text: 'You lift on the straight. The team says thanks. You say nothing at all.', fx: { lose: 1, teamRel: 6 } } },
    {
      label: 'Pretend the radio is broken', stat: 'composure', base: 45,
      ok: { text: '"Sorry, what? Radio\'s breaking up." You hold position. The garage goes very quiet.', fx: { teamRel: -6, fame: 2, flag: 'disobeyed', ach: 'multi21' } },
      ko: { text: 'The radio was not broken, and the whole world heard you say so. The debrief will be awkward.', fx: { teamRel: -12, fame: 1, flag: 'disobeyed', ach: 'multi21' } },
    },
    {
      label: 'Ask them to let you race', stat: 'racecraft', base: 50,
      ok: { text: 'They let you race. You hold him off, fair and square.', fx: { teamRel: -2 } },
      ko: { text: 'They let you race. He passes you anyway. Silence on the radio.', fx: { lose: 1, teamRel: -1 } },
    },
  ],
});

ev({
  id: 'team_orders_get',
  phase: 'race',
  w: 3,
  gap: 8,
  when: (s, c) => c.tmAhead,
  title: (s, c) => `${c.track}: team orders`,
  radio: (s, c) => `${c.eng}: "Copy. We're asking ${c.tm.last} to let you by."`,
  text: 'You have been faster for ten laps and the team has noticed.',
  choices: [
    { label: 'Accept the gift', ok: { text: 'He moves over. You owe him one, and he will remind you. Often.', fx: { gain: 1, teamRel: 2 } } },
    {
      label: "Tell them you'll pass him yourself", stat: 'racecraft', base: 50,
      ok: { text: 'You do it on track instead. Respect earned in the garage and the grandstands.', fx: { gain: 1, fame: 2 } },
      ko: { text: 'You cannot find a way past. Should have taken the gift.', fx: {} },
    },
  ],
});

ev({
  id: 'tyres_cliff',
  phase: 'race',
  w: 2,
  gap: 5,
  title: (s, c) => `${c.track}: lap ${c.lap}`,
  text: 'Fifteen laps to go and the tyres feel like they are made of soap.',
  choices: [
    {
      label: 'Nurse them home', stat: 'consistency', base: 55,
      ok: { text: 'Smooth inputs, gentle throttle, and the tyres last to the flag.', fx: { mod: 1 } },
      ko: { text: 'They fall off a cliff anyway. You slide home.', fx: { mod: -2 } },
    },
    { label: 'Make an extra pit stop', ok: { text: 'Safe and slow. You lose time but finish on fresh rubber.', fx: { mod: -0.8 } } },
    {
      label: 'Push and pray', stat: 'pace', base: 35,
      ok: { text: 'Somehow the tyres hang on. Fastest laps of your race at the very end.', fx: { mod: 3, fame: 1 } },
      ko: { text: 'They do not hang on. Flat-spotted, you limp home.', fx: { mod: -4 } },
    },
  ],
  variants: [
    {
      title: (s, c) => `${c.track}: lap ${c.lap} of ${c.laps}`,
      text: (s, c) =>
        byKind(c, {
          street: `${lapsLeft(c)} laps to go. The rears are sliding out of every slow corner, and the walls get closer every lap.`,
          fast: `${lapsLeft(c)} laps to go. The front tyres are graining from all those fast sweepers, and the car pushes wide in every high-speed corner.`,
          technical: `${lapsLeft(c)} laps to go. All those traction zones have eaten the rear tyres, and the car steps out at every slow exit.`,
        }),
      choices: [
        { ok: 'Short-shifting, gentle on the throttle, kind to the rubber. They last.', ko: 'You manage them, and they fall off a cliff anyway. A long slide to the flag.' },
        { ok: 'You take the extra stop. It costs time, but the new tyres make it feel like a different car.' },
        { ok: 'You push, and against all logic the tyres come back to you. Fastest laps of your race at the end.', ko: 'The tyres give up completely. Flat-spotted and shaking, you limp home.' },
      ],
    },
    {
      when: (s, c) => c.wet,
      text: (s, c) => `The track is drying and your wet-weather tyres are melting. ${lapsLeft(c)} laps to go, and the tread is disappearing in front of your eyes.`,
      choices: [
        { ok: 'You hunt for every damp patch to cool the tyres and nurse them to the end.', ko: 'There are not enough damp patches. The tyres overheat and you slide home.' },
        { ok: 'You pit for fresh tyres. It costs time, but you finish on rubber that actually works.' },
        { ok: 'You push on melting rubber and it somehow works. The commentators call it brave. Your engineer calls it lucky.', ko: 'The tyres disintegrate. You limp home on what is left of them.' },
      ],
    },
    {
      title: (s, c) => `${c.track}: tyres`,
      radio: (s, c) => `${c.eng}: "Tyres are at the end of their life. Your call."`,
      text: (s, c) => `${lapsLeft(c)} laps to go. The lap times are tumbling, the car behind is closing, and every corner feels like ice.`,
      choices: [
        { ok: 'Smooth hands, patient feet. The tyres hang on to the flag.', ko: 'You nurse them and they die anyway. You slither home, losing time every lap.' },
        { ok: 'Box, fresh rubber, out again. A little slower, a lot safer.' },
        { ok: 'You ignore the warning and push. The tyres somehow hold, and you set your fastest laps at the very end.', ko: 'They do not hold. A flat-spotted, vibrating crawl to the finish.' },
      ],
    },
  ],
});

ev({
  id: 'quali_lap',
  phase: 'race',
  w: 3,
  gap: 4,
  title: (s, c) => `${c.track}: qualifying`,
  text: (s, c) => `Final run of qualifying. The track is rubbering in and your engineer says you are ${c.f1 ? 'two tenths' : 'a tenth and a half'} off the top.`,
  choices: [
    {
      label: 'Risk everything in the last sector', stat: 'pace', base: 48,
      ok: { text: 'Purple, purple, purple. A lap on the absolute limit.', fx: { qmod: 2.5, fame: 1 } },
      ko: { text: 'You clip the wall at the last corner. Lap deleted, starting near the back.', fx: { qmod: -4 } },
    },
    { label: 'Bank a clean lap', ok: { text: 'Neat, tidy, a fair reflection of the car.', fx: { qmod: 0.3 } } },
  ],
  variants: [
    {
      title: (s, c) => `${c.track}: final run`,
      text: (s, c) =>
        byKind(c, {
          street: `Last run in qualifying around ${c.place}. The walls are close enough to touch and the track gets quicker every lap. You are ${qGap(c)} off the top, with nowhere to hide a mistake.`,
          fast: `Last run in qualifying at ${c.place}: long straights, fast sweepers, and a tow worth a tenth if you can find one. You are ${qGap(c)} off the top.`,
          technical: `Last run at ${c.place}. Corner after corner after corner, and the tyres only give you one proper lap. You are ${qGap(c)} off the top.`,
        }),
      choices: [
        {
          ok: (s, c) =>
            byKind(c, {
              street: 'You brush the barrier on the exit of the last corner and the lap lights up purple. The mechanics check the wheel rim and grin.',
              fast: 'Flat through the fast stuff, a perfect tow down the straight, purple everywhere. Mega.',
              technical: 'Every apex kissed, every exit perfect. Purple in all three sectors.',
            }),
          ko: (s, c) =>
            byKind(c, {
              street: 'You find the wall instead of the time. Lap deleted, and you start near the back.',
              fast: 'Too greedy through the quickest corner. Four wheels off, lap deleted, and a start near the back.',
              technical: 'You run wide at the final corner. Track limits, lap deleted, starting near the back.',
            }),
        },
        { ok: 'A tidy lap, with nothing left on the table and nothing in the wall. The car starts where it deserves.' },
      ],
    },
    {
      when: (s, c) => c.tm,
      text: (s, c) => `Final run of qualifying, and the timing screen says ${c.tm.last} is ${qGap(c)} quicker in the other ${c.team}. Nobody in the garage says a word. Nobody needs to.`,
      choices: [
        {
          ok: (s, c) => `A purple final sector. Over in the other garage, ${c.tm.last} watches the timing screen very quietly.`,
          ko: (s, c) => `Too hard at the last corner. Lap deleted, a start near the back, and ${c.tm.last} will not let you forget it.`,
        },
        { ok: (s, c) => `A clean, honest lap. The data will tell you where ${c.tm.last} found the time.` },
      ],
    },
    {
      title: (s, c) => `${c.track}: qualifying, last run`,
      radio: (s, c) => `${c.eng}: "${c.f1 ? 'Two tenths' : 'A tenth and a half'} off. Last set of tyres. Make it count."`,
      text: 'One set of tyres left and one lap to get it right. The track gets faster with every car that goes round.',
      choices: [
        { ok: 'You leave nothing on the table. A lap on the very edge, and the timing screen turns purple.', ko: 'A snap of oversteer at the final corner. Lap gone, and so is your grid slot.' },
        { ok: 'You bank a clean lap. Not spectacular, not wasted.' },
      ],
    },
  ],
});

ev({
  id: 'undercut',
  phase: 'race',
  w: 2,
  gap: 5,
  when: (s, c) => c.pos >= 2 && c.pos <= 8 && c.ahead,
  title: (s, c) => `${c.track}: strategy`,
  radio: (s, c) => `${c.eng}: "${c.ahead.last} is about to pit. Thoughts?"`,
  text: (s, c) => `You are within two seconds of ${c.ahead.name}. The pit window is open.`,
  choices: [
    {
      label: 'Box first for the undercut', stat: 'technical', base: 52,
      ok: { text: 'In-lap perfect, out-lap faster. You jump him in the pits.', fx: { gain: 1 } },
      ko: { text: 'Cold tyres, slow out-lap, and he comes out ahead. Then someone else does too.', fx: { lose: 1 } },
    },
    {
      label: 'Stay out for the overcut', stat: 'consistency', base: 50,
      ok: { text: 'He emerges into traffic while you bang in purple sectors. Overcut works.', fx: { gain: 1 } },
      ko: { text: 'Your old tyres have nothing left. The overcut fails.', fx: {} },
    },
  ],
});

ev({
  id: 'drs_train',
  phase: 'race',
  w: 2,
  gap: 5,
  when: (s, c) => c.pos >= 5 && c.pos <= 16 && c.ahead,
  title: (s, c) => `${c.track}: stuck in a train`,
  text: (s, c) => `Six cars nose to tail, all with the overtaking flap open, nobody getting anywhere. ${c.ahead.last} is in front of you.`,
  choices: [
    {
      label: 'Be patient and wait for a mistake', stat: 'consistency', base: 55,
      ok: { text: (s, c) => `${c.ahead.last} locks up at the hairpin. You were waiting for exactly that.`, fx: { gain: 1 } },
      ko: { text: 'Nobody makes a mistake. You finish where you started.', fx: {} },
    },
    {
      label: 'Force it, two cars in one go', stat: 'racecraft', base: 40,
      ok: { text: 'A double overtake at the end of the straight. Clip of the race.', fx: { gain: 2, fame: 2 } },
      ko: { text: 'You run out of road. Down a place, with a cut tyre to remember it by.', fx: { lose: 1, mod: -1 } },
    },
  ],
});

ev({
  id: 'leader_pressure',
  phase: 'race',
  w: 5,
  gap: 3,
  when: (s, c) => c.pos === 1 && c.behind,
  title: (s, c) => `${c.track}: leading`,
  text: (s, c) => `Ten laps to go. You lead, and ${c.behind.name} is taking three tenths a lap out of you.`,
  choices: (s, c) => [
    {
      label: 'Push flat out to the end', stat: 'pace', base: 55,
      ok: { text: 'You find another gear when it matters. The gap stabilises, then grows.', fx: {} },
      ko: { text: `A lock-up at the hairpin and ${c.behind.last} is through. So close.`, fx: { lose: 1 } },
    },
    {
      label: 'Manage the gap, protect the tyres', stat: 'consistency', base: 58,
      ok: { text: 'Calm, metronomic laps. The attack never quite arrives.', fx: {} },
      ko: { text: `Too conservative. ${c.behind.last} gets the run on the final straight.`, fx: { lose: 1 } },
    },
  ],
});

ev({
  id: 'pit_fail',
  phase: 'race',
  w: 1.5,
  gap: 8,
  title: (s, c) => `${c.track}: pit stop`,
  text: 'The front-left wheel gun jams. Two seconds. Three. Four. The mechanics are fighting it.',
  choices: [
    {
      label: 'Stay calm and wait', stat: 'composure', base: 55,
      ok: { text: 'You keep your cool, rejoin, and claw the time back with a set of mega laps.', fx: { mod: -0.5, teamRel: 2 } },
      ko: { text: 'You rejoin in traffic and never recover.', fx: { mod: -2 } },
    },
    { label: 'Scream on the radio', ok: { text: 'It is very entertaining for the broadcast and not at all helpful. The mechanics will remember.', fx: { mod: -1.5, teamRel: -4, fame: 2 } } },
  ],
});

ev({
  id: 'blue_flags',
  phase: 'race',
  w: 1.5,
  gap: 8,
  when: (s, c) => c.pos >= 15,
  title: (s, c) => `${c.track}: blue flags`,
  text: 'The leaders are coming through to lap you. Blue flags are waving everywhere.',
  choices: [
    { label: 'Move aside politely', ok: { text: 'You let them through cleanly. The leader gives you a thumbs up. Small mercies.', fx: { teamRel: 1 } } },
    {
      label: 'Defend like it is for the win', stat: 'racecraft', base: 45,
      ok: { text: 'You hold off the race leader for two laps before the stewards notice. It goes viral.', fx: { fame: 3 } },
      ko: { text: 'Drive-through penalty for ignoring blue flags. Worth it? Probably not.', fx: { lose: 2, fame: -1, teamRel: -2 } },
    },
  ],
});

ev({
  id: 'stewards',
  phase: 'race',
  w: 1.5,
  gap: 8,
  when: (s, c) => c.pos >= 2 && c.ahead,
  title: (s, c) => `${c.track}: under investigation`,
  text: (s, c) => `Contact with ${c.ahead.last} at Turn 4. The stewards want to see you after the race.`,
  choices: [
    {
      label: 'Argue your case with the onboard footage', stat: 'composure', base: 50,
      ok: { text: 'Racing incident, no further action. You were very convincing.', fx: {} },
      ko: { text: 'Ten-second penalty. The footage did not help.', fx: { lose: 2 } },
    },
    { label: 'Apologise and accept it', ok: { text: 'A five-second penalty and a handshake. The paddock respects it.', fx: { lose: 1, fame: 1 } } },
  ],
});

ev({
  id: 'rival_ahead',
  phase: 'race',
  w: 6,
  gap: 5,
  when: (s, c) => c.rival && c.rival.directlyAhead,
  title: (s, c) => `${c.track}: ${c.rival.last}. Again.`,
  text: (s, c) => `The car in front is ${c.rival.name}. Of course it is. You have been trading paint and insults since you were eleven.`,
  choices: (s, c) => [
    {
      label: 'Settle it on track', stat: 'racecraft', base: 48,
      ok: { text: `You pass ${c.rival.last} round the outside and wave on the way by. Childish. Delicious.`, fx: { gain: 1, fame: 2, flag: 'beat_rival' } },
      ko: { text: `${c.rival.last} chops across your nose. You both go off, and only ${c.rival.last} rejoins in front.`, fx: { lose: 1, fame: -1 } },
    },
    {
      label: 'Rise above it', stat: 'composure', base: 55,
      ok: { text: 'You ignore the history and drive your own race. It works better than you expected.', fx: { mod: 1, stats: { composure: 1 } } },
      ko: { text: `You can't stop thinking about ${c.rival.last}. Mistakes creep in.`, fx: { mod: -1 } },
    },
  ],
});

ev({
  id: 'rival_behind',
  phase: 'race',
  w: 6,
  gap: 5,
  when: (s, c) => c.rival && c.rival.directlyBehind,
  title: (s, c) => `${c.track}: ${c.rival.last} in the mirrors`,
  text: (s, c) => `${c.rival.name} is right behind you. Since karting, ${firstName(c.rival.name)} has never once let you forget that national final.`,
  choices: (s, c) => [
    {
      label: 'Defend like your life depends on it', stat: 'racecraft', base: 52,
      ok: { text: `${c.rival.last} tries everything and gets nothing. Sweetest finish of the year.`, fx: { fame: 2, flag: 'beat_rival' } },
      ko: { text: `${c.rival.last} gets past and waves. You will see that wave in your sleep.`, fx: { lose: 1 } },
    },
    {
      label: 'Brake-test him', stat: 'composure', base: 30, risky: true,
      ok: { text: 'He backs off, rattled. The stewards somehow miss it. You are not proud. Not much.', fx: { fame: 1 } },
      ko: { text: 'He hits the back of you. Both cars out, both team bosses furious.', fx: { dnf: true, fame: -3, teamRel: -8 } },
    },
  ],
});

ev({
  id: 'home_race',
  phase: 'race',
  w: 8,
  gap: 12,
  when: (s, c) => c.home,
  title: (s, c) => `${c.track}: home race`,
  text: (s, c) => `The grandstands are full of ${c.adj} flags and half of them have your name on. The noise is ridiculous and so is the pressure.`,
  choices: [
    {
      label: 'Feed off the crowd', stat: 'composure', base: 50,
      ok: { text: 'Every lap the noise lifts you. Your best drive of the season, in front of the people who matter most.', fx: { mod: 2.5, fame: 3 } },
      ko: { text: 'You try far too hard and make mistakes. They cheer anyway, which somehow makes it worse.', fx: { mod: -2 } },
    },
    { label: 'Treat it like any other race', ok: { text: 'Earplugs in, routine unchanged. Solid and professional.', fx: { mod: 0.8, fame: 1 } } },
  ],
});

ev({
  id: 'debrief_feedback',
  phase: 'race',
  w: 1,
  gap: 10,
  title: (s, c) => `${c.track}: practice`,
  text: 'Friday practice. The car is understeering everywhere and the engineers want your read on why.',
  choices: [
    {
      label: 'Give detailed setup feedback', stat: 'technical', base: 55,
      ok: { text: 'Your feedback nails it: front ride height. The car comes alive on Saturday.', fx: { mod: 1.5, teamRel: 2 } },
      ko: { text: 'You send them down a rabbit hole. Saturday is spent undoing Friday.', fx: { mod: -1 } },
    },
    { label: 'Drive around the problem', ok: { text: 'You adapt your style. Not fast, not slow.', fx: { stats: { racecraft: 1 } } } },
  ],
});

// ------------------------------------------------------ race: track specials

ev({
  id: 'monaco_wall',
  phase: 'race',
  w: 9,
  gap: 12,
  when: (s, c) => c.trackId === 'monaco',
  title: 'Monaco: qualifying',
  text: 'The barriers are so close you can read the sponsor logos from the cockpit. Here, Saturday is the race.',
  choices: [
    {
      label: 'Brush the barrier at the Swimming Pool', stat: 'pace', base: 45,
      ok: { text: 'You kiss the wall with the rear tyre and it is the fastest lap anyone has ever seen from you.', fx: { qmod: 4, fame: 2 } },
      ko: { text: 'You kiss it a little too passionately. Broken suspension, back of the grid.', fx: { qmod: -8 } },
    },
    { label: 'Clean and tidy', ok: { text: 'Respect the walls. Respect the walls. Respect the walls.', fx: { qmod: 0.5 } } },
  ],
});

ev({
  id: 'spa_eau_rouge',
  phase: 'race',
  w: 6,
  gap: 12,
  when: (s, c) => c.trackId === 'belgium',
  title: 'Spa: Eau Rouge',
  text: (s, c) => `Down the hill towards Eau Rouge${c.wet ? ' in the spray' : ''}. Flat or lift? Your right foot is waiting for an answer.`,
  choices: [
    {
      label: 'Flat. Obviously.', stat: 'composure', base: 48,
      ok: { text: 'Flat through Eau Rouge and Raidillon. You are a different person at the top of the hill.', fx: { mod: 2.5, fame: 1 } },
      ko: { text: 'You lift, then you do not, then you are in the gravel at the top of Raidillon.', fx: { mod: -5 } },
    },
    { label: 'Breathe the throttle', ok: { text: 'A tiny lift. Nobody saw. Probably.', fx: {} } },
  ],
});

ev({
  id: 'singapore_heat',
  phase: 'race',
  w: 6,
  gap: 12,
  when: (s, c) => c.trackId === 'singapore',
  title: 'Singapore: the sauna',
  radio: (s, c) => `${c.eng}: "Your drink bottle isn't working. Sorry."`,
  text: 'Ninety degrees of humidity, a cockpit like an oven and two hours of walls. Your vision is starting to tunnel.',
  choices: [
    {
      label: 'Grit your teeth', stat: 'consistency', base: 50,
      ok: { text: 'You hold it together and pass two cars wilting in the heat.', fx: { mod: 1.5, fame: 1 } },
      ko: { text: 'You lose concentration and clip a wall. The car is fine. Your lap time is not.', fx: { mod: -3 } },
    },
    { label: 'Back off and survive', ok: { text: 'A slower pace, a cooler head, and a finish.', fx: { mod: -1 } } },
  ],
});

ev({
  id: 'vegas_night',
  phase: 'race',
  w: 6,
  gap: 12,
  when: (s, c) => c.trackId === 'vegas',
  title: 'Las Vegas: the night before',
  text: 'The race starts at ten at night. A sponsor invites you to a VIP suite at a casino. There will be a magician.',
  choices: (s) => [
    {
      label: 'Go, but only for an hour', stat: 'composure', base: 55,
      ok: { text: 'You shake the right hands, leave at nine, and sleep like a baby.', fx: { fame: 2, money: pay(s, 250000) } },
      ko: { text: 'One hour becomes four. You qualify wearing sunglasses.', fx: { qmod: -2.5, fame: 2 } },
    },
    { label: 'Early night', ok: { text: 'Room service and onboard videos. Wild.', fx: { qmod: 0.5 } } },
  ],
});

ev({
  id: 'monza_tow',
  phase: 'race',
  w: 6,
  gap: 12,
  when: (s, c) => c.trackId === 'italy',
  title: 'Monza: the tow games',
  text: 'Final qualifying run at the Temple of Speed. Everybody wants a slipstream and nobody wants to give one.',
  choices: [
    {
      label: 'Play the tow game', stat: 'composure', base: 45,
      ok: { text: 'You slot in behind the perfect car and get a monster tow. Three tenths, free.', fx: { qmod: 2.5 } },
      ko: { text: 'Everybody slows down so much that half of you miss the chequered flag. Including you.', fx: { qmod: -3, fame: 1 } },
    },
    { label: 'Go out first and set a banker', ok: { text: 'No tow, no drama, no regrets.', fx: { qmod: 0 } } },
  ],
});

ev({
  id: 'suzuka_130r',
  phase: 'race',
  w: 5,
  gap: 12,
  when: (s, c) => c.trackId === 'japan',
  title: 'Suzuka: 130R',
  text: 'Suzuka on a qualifying lap. 130R is coming at three hundred kilometres an hour.',
  choices: [
    {
      label: 'Flat through 130R', stat: 'pace', base: 50,
      ok: { text: 'Flat, with a twitch that will be replayed for years. The Japanese fans go wild.', fx: { qmod: 2.5, fame: 2 } },
      ko: { text: 'A twitch becomes a slide becomes a lap deleted.', fx: { qmod: -3 } },
    },
    { label: 'Tiny confidence lift', ok: { text: 'Respectable. The data says you lost a tenth there. The data can be quiet.', fx: {} } },
  ],
});

ev({
  id: 'brazil_chaos',
  phase: 'race',
  banner: 'red',
  w: (s, c) => (c.wet ? 8 : 3),
  gap: 12,
  when: (s, c) => c.trackId === 'brazil',
  title: 'Interlagos: chaos',
  text: 'A wall of rain hits the Senna S. Red flag. Restart from the grid with standing water everywhere.',
  choices: [
    {
      label: 'Go for it at the restart', stat: 'wet', base: 48,
      ok: { text: 'You pass four cars in the spray. Ayrton would have nodded.', fx: { mod: 4, fame: 3 } },
      ko: { text: 'You aquaplane at Turn 1 and spin. Still going, at the back.', fx: { mod: -4 } },
    },
    { label: 'Keep it on the black stuff', ok: { text: 'Measured, careful, and three cars crash around you.', fx: { mod: 1 } } },
  ],
});

ev({
  id: 'baku_straight',
  phase: 'race',
  w: 5,
  gap: 12,
  when: (s, c) => c.trackId === 'baku' && c.ahead,
  title: 'Baku: the long straight',
  text: (s, c) => `Two kilometres of flat out along the seafront, and ${c.ahead.last} is a sitting duck in your slipstream.`,
  choices: [
    {
      label: 'Pull out late and pass at Turn 1', stat: 'pace', base: 52,
      ok: { text: (s, c) => `Late out of the tow, past ${c.ahead.last} before the braking zone. Easy.`, fx: { gain: 1 } },
      ko: { text: 'You leave it too late and lock up into Turn 1. Escape road.', fx: { lose: 1 } },
    },
    { label: 'Wait for the next lap', ok: { text: 'Patience. The pass comes two laps later, with less drama.', fx: { mod: 0.5 } } },
  ],
});

// ------------------------------------------------------ between races

ev({
  id: 'viral_radio',
  phase: 'between',
  w: 2,
  title: 'Gone viral',
  text: 'A clip of your team radio rant ("THIS CAR IS UNDRIVEABLE, I SWEAR TO") has eleven million views and counting.',
  choices: (s) => [
    { label: 'Apologise publicly', ok: { text: 'Measured, humble, a bit boring. The team appreciates it.', fx: { teamRel: 3 } } },
    {
      label: 'Print it on T-shirts', stat: 'composure', base: 55,
      ok: { text: 'They sell out in four hours. You are now a meme, and a profitable one.', fx: { fame: 4, money: pay(s, 400000) } },
      ko: { text: 'The team was not consulted and is not amused.', fx: { teamRel: -5, fame: 3 } },
    },
    { label: 'Say nothing', ok: { text: 'The internet moves on in about a day and a half.', fx: {} } },
  ],
});

ev({
  id: 'sponsor_energy',
  phase: 'between',
  w: 2,
  title: 'A sponsor calls',
  text: 'An energy drink with a very loud logo wants you as an ambassador. The drink tastes like a battery.',
  choices: (s) => [
    { label: 'Sign the deal', ok: { text: 'You film an advert jumping off a dam. The money is very real.', fx: { money: pay(s, 1500000), fame: 2 } } },
    { label: 'Hold out for a better brand', stat: 'composure', base: 45, ok: { text: 'A Swiss watchmaker hears you are available and offers more. Patience pays.', fx: { money: pay(s, 2500000), fame: 3 } }, ko: { text: 'Both brands go elsewhere. Oops.', fx: {} } },
    { label: 'Not interested', ok: { text: 'You want to be known for racing, not for drinking batteries.', fx: { stats: { composure: 1 } } } },
  ],
});

ev({
  id: 'sponsor_crypto',
  phase: 'between',
  once: true,
  w: 1.5,
  when: (s) => s.driver.fame >= 15,
  title: 'A generous offer',
  text: 'CoinRocket, a crypto exchange you have never heard of, wants its logo on your helmet. The offer is suspiciously generous.',
  choices: (s) => [
    { label: 'Take the money', ok: { text: 'The cheque clears. The logo is a rocket wearing sunglasses.', fx: { money: pay(s, 4000000), flag: 'crypto' } } },
    { label: 'Decline politely', ok: { text: 'Something about it feels off. Your agent sulks for a week.', fx: { stats: { composure: 1 } } } },
  ],
});

ev({
  id: 'crypto_collapse',
  phase: 'between',
  once: true,
  w: 8,
  when: (s) => s.flags.crypto && s.flags.crypto < s.year,
  title: 'CoinRocket collapses',
  text: 'CoinRocket collapsed overnight and its founder is on a yacht somewhere without an extradition treaty. Your face is still on their billboards.',
  choices: [
    { label: 'Apologise to fans who lost money', ok: { text: 'You donate your fee to a fund for affected fans. Classy, and expensive.', fx: (s) => ({ fame: 1, money: -Math.min(s.driver.money, pay(s, 3000000)), ach: 'crypto_bust' }) } },
    {
      label: 'Claim you never met them', stat: 'composure', base: 40,
      ok: { text: 'Nobody can prove otherwise. You get away with it.', fx: { ach: 'crypto_bust' } },
      ko: { text: 'A photo of you hugging the founder surfaces. Brutal week.', fx: { fame: -6, ach: 'crypto_bust' } },
    },
  ],
});

ev({
  id: 'interview_teammate',
  phase: 'between',
  w: 2,
  when: (s, c) => c.tm,
  title: 'Media day',
  text: (s, c) => `A journalist leans in: "Be honest. Is ${c.tm.last} faster than you?"`,
  choices: [
    {
      label: 'Give a diplomatic answer', stat: 'composure', base: 50,
      ok: { text: '"We push each other, it\'s healthy." Perfect PR. The team smiles.', fx: { teamRel: 2 } },
      ko: { text: 'You hesitate for a beat too long. The headline writes itself.', fx: { teamRel: -2, fame: 1 } },
    },
    { label: '"Ask the stopwatch."', ok: { text: 'It is the quote of the week. Your teammate is not laughing.', fx: { fame: 2, teamRel: -2 } } },
  ],
});

ev({
  id: 'neck_training',
  phase: 'between',
  w: 1.5,
  title: 'Physio room',
  text: 'Your neck aches after the last high-speed track. The physio has opinions and a very heavy helmet on a pulley.',
  choices: [
    { label: 'Extra neck training', ok: { text: 'Three weeks of misery. Your neck is now wider than your head.', fx: { stats: { consistency: 1 } } } },
    { label: 'Rest and recover', ok: { text: 'Massage, ice baths, sleep. You come back sharp.', fx: { stats: { composure: 1 } } } },
  ],
});

ev({
  id: 'sim_night',
  phase: 'between',
  w: 1.5,
  title: 'Simulator call',
  radio: (s, c) => `${c.eng}: "Any chance you can do a night shift in the sim? New floor next week."`,
  text: 'The factory needs a driver to correlate the upgrade. It will be a ten-hour session in a dark room.',
  choices: [
    { label: 'Do the overnight session', ok: { text: 'Six hundred laps, four coffees and one very good upgrade direction.', fx: { stats: { technical: 1 }, teamRel: 3, carPerf: 0.3 } } },
    { label: 'Decline and rest', ok: { text: 'You sleep. The reserve driver does it. The engineers notice who did.', fx: { teamRel: -2, stats: { composure: 1 } } } },
  ],
});

ev({
  id: 'mentor',
  phase: 'between',
  once: true,
  w: 1.5,
  when: (s) => s.career.series === 'F2' || s.career.series === 'F1',
  title: 'A legend calls',
  text: 'A retired three-time world champion invites you for lunch and offers to mentor you. Rumour has it they only say yes to one driver a decade.',
  choices: [
    { label: 'Accept, gratefully', ok: { text: 'Every Tuesday, a phone call. Every call, a lesson. You get better in ways you cannot measure.', fx: { stats: { racecraft: 2, composure: 2 }, flag: 'mentor' } } },
    { label: 'Politely decline', ok: { text: 'You want to find your own way. The legend respects that, slightly.', fx: { stats: { composure: 1 } } } },
  ],
});

ev({
  id: 'game_rating',
  phase: 'between',
  once: true,
  w: 2,
  series: F1,
  title: 'The video game ratings',
  text: (s, c) => `The official game has revealed driver ratings. You are a ${c.ovr - 3}. You are absolutely certain you are faster than a ${c.ovr - 3}.`,
  choices: [
    {
      label: 'Complain online', stat: 'composure', base: 45,
      ok: { text: 'Your complaint is so funny the developers bump you up by one in a patch.', fx: { fame: 3 } },
      ko: { text: 'You are ratioed by a fourteen-year-old. Painful.', fx: { fame: -1 } },
    },
    { label: 'Laugh it off', ok: { text: '"I\'ll drive the real car, they can drive the game." Classy.', fx: { fame: 1 } } },
  ],
});

ev({
  id: 'romance',
  phase: 'between',
  once: true,
  w: 1.5,
  when: (s) => s.driver.age >= 19,
  title: 'A charity gala',
  text: (s, c) => `At a charity gala in ${c.city} you spend two hours talking to an architect who has never watched a race in their life. It is the best conversation you have had in years.`,
  choices: [
    {
      label: 'Ask them out', stat: 'composure', base: 50,
      ok: { text: 'They say yes. They also ask what DRS means. You are smitten.', fx: { flag: 'partner', fame: 1, stats: { composure: 1 } } },
      ko: { text: 'They give you a polite "maybe". It turns out to mean no.', fx: {} },
    },
    { label: 'Focus on racing', ok: { text: 'You go back to your hotel and watch onboards. Romantic.', fx: { stats: { consistency: 1 } } } },
  ],
});

ev({
  id: 'proposal',
  phase: 'between',
  once: true,
  w: 2,
  when: (s) => s.flags.partner && s.driver.age >= 24 && s.flags.partner <= s.year - 2,
  title: 'The ring',
  text: 'You have been carrying a ring around in your race bag for six weeks. The mechanics keep asking what is in the little box.',
  choices: [
    { label: 'Propose on a beach after the race', p: 90, ok: { text: 'They say yes. The mechanics, who were hiding behind a palm tree, cheer.', fx: { flag: 'married', fame: 3, stats: { composure: 2 } } }, ko: { text: '"Not yet," they say, kindly. You put the ring back in the bag.', fx: {} } },
    { label: 'Wait for the right moment', ok: { text: 'The ring stays in the bag. The moment will come.', fx: {} } },
  ],
});

ev({
  id: 'baby',
  phase: 'between',
  once: true,
  w: 3,
  when: (s) => s.flags.married && s.flags.married <= s.year - 1,
  title: 'Big news',
  text: 'Your partner hands you a tiny pair of race boots. You stare at them for a very long time before it lands.',
  choices: [
    { label: 'Cry, a lot', ok: { text: 'You are going to be a parent. Lap times suddenly seem a little less important, and you drive better for it.', fx: { flag: 'parent', stats: { composure: 3 }, fame: 2, ach: 'family' } } },
  ],
});

ev({
  id: 'buy_supercar',
  phase: 'between',
  once: true,
  w: 2,
  when: (s) => s.driver.money >= 4000000,
  title: 'The dealership',
  text: 'Your agent has booked a viewing of a hypercar with doors that open like wings and fuel economy that makes scientists weep.',
  choices: [
    { label: 'Buy it ($3M)', ok: { text: 'You drive it home at exactly the speed limit. It is very loud.', fx: { money: -3000000, asset: { name: 'Hypercar', value: 2400000 }, fame: 1 } } },
    { label: 'Keep your old hatchback', ok: { text: 'The internet loves a grounded driver. "Racer still drives a dented hatchback" is the most-read story of the week.', fx: { fame: 2 } } },
  ],
});

ev({
  id: 'buy_monaco',
  phase: 'between',
  once: true,
  w: 2,
  when: (s) => s.driver.money >= 12000000,
  title: 'A view of the harbour',
  text: 'Half the grid lives in Monaco. An estate agent sends you photos of an apartment overlooking the Swimming Pool chicane.',
  choices: [
    { label: 'Buy the apartment ($9M)', ok: { text: 'You can watch the Monaco Grand Prix from your balcony. You will be racing in it, but still.', fx: { money: -9000000, asset: { name: 'Monaco apartment', value: 10000000 }, flag: 'monaco' } } },
    { label: 'Stay where you are', ok: { text: 'Home is home. Your mum is delighted.', fx: { stats: { composure: 1 } } } },
  ],
});

ev({
  id: 'buy_yacht',
  phase: 'between',
  once: true,
  w: 2,
  when: (s) => s.driver.money >= 45000000,
  title: 'Boat show',
  text: 'A man in a white suit wants to sell you a superyacht. It has a helipad and a smaller yacht inside it.',
  choices: [
    { label: 'Buy the yacht ($35M)', ok: { text: 'You name it "Lights Out". You get seasick on day one.', fx: { money: -35000000, asset: { name: 'Superyacht', value: 25000000 }, fame: 2, flag: 'yacht' } } },
    { label: 'Invest it instead', stat: 'technical', base: 50, ok: { text: 'You put it in index funds like a sensible person. Very rich, very boring.', fx: { money: 6000000 } }, ko: { text: 'You put it into a "can\'t-lose" fund your physio recommended. It lost.', fx: { money: -5000000 } } },
  ],
});

ev({
  id: 'foundation',
  phase: 'between',
  once: true,
  w: 2,
  when: (s) => s.driver.money >= 6000000,
  title: 'Giving back',
  text: 'A karting club near where you grew up is closing. They cannot afford new tyres, never mind the rent.',
  choices: [
    { label: 'Start a foundation ($2M)', ok: { text: 'The Lights Out Foundation buys the club, the karts and ten years of tyres. Kids who could never afford it now get a shot.', fx: { money: -2000000, fame: 4, flag: 'foundation', ach: 'foundation' } } },
    { label: 'Send a signed helmet', ok: { text: 'They auction it for six thousand. It helps, a bit.', fx: { fame: 1 } } },
  ],
});

ev({
  id: 'party',
  phase: 'between',
  w: 1.5,
  when: (s) => s.driver.age >= 18,
  title: 'Night out',
  text: (s, c) => `A rapper you have definitely heard of invites you to a party in ${c.city}. The next race is in five days.`,
  choices: [
    {
      label: 'Go', stat: 'composure', base: 50,
      ok: { text: 'Great night, home by two, photos all flattering. You are suddenly cool.', fx: { fame: 3 } },
      ko: { text: 'A photo of you asleep in a fountain is on every front page.', fx: { fame: -2, teamRel: -4 } },
    },
    { label: 'Stay in', ok: { text: 'You go to bed at ten with a book about tyre degradation.', fx: { stats: { consistency: 1 } } } },
  ],
});

ev({
  id: 'boss_pressure',
  phase: 'between',
  w: (s, c) => (c.struggling ? 6 : 0),
  title: 'Motorhome meeting',
  text: (s, c) => `The ${c.team} boss calls you in and closes the door. "We need results. Not next year. Now."`,
  choices: [
    {
      label: 'Promise results', stat: 'composure', base: 50,
      ok: { text: 'You look the boss in the eye and mean it. The team rallies around you.', fx: { teamRel: 4, stats: { composure: 1 } } },
      ko: { text: 'It sounds hollow, even to you.', fx: { teamRel: -3 } },
    },
    { label: 'Blame the car', ok: { text: 'True, maybe. Wise, no.', fx: { teamRel: -6, fame: 1 } } },
    {
      label: 'Ask for the next upgrade first', stat: 'technical', base: 55,
      ok: { text: 'Your argument is so technical that the boss agrees just to end the meeting. New floor, your car, next race.', fx: { carPerf: 0.6, teamRel: 1 } },
      ko: { text: 'Your teammate gets it instead. Of course.', fx: { teamRel: -2 } },
    },
  ],
});

ev({
  id: 'rival_trash',
  phase: 'between',
  w: 2,
  gap: 20,
  when: (s, c) => c.rival,
  title: 'War of words',
  text: (s, c) => `${c.rival.name} tells a podcast that you "drive like a taxi with a flat tyre".`,
  choices: [
    { label: 'Fire back', ok: { text: (s, c) => `"At least taxis finish races." Brutal. The internet crowns you winner. ${firstName(c.rival.name)} does not reply.`, fx: { fame: 3 } } },
    { label: 'Stay classy', ok: { text: '"Everyone is entitled to an opinion." Infuriatingly calm.', fx: { stats: { composure: 1 }, fame: 1 } } },
  ],
});

ev({
  id: 'academy_warning',
  phase: 'between',
  w: (s, c) => (c.struggling ? 5 : 0),
  when: (s) => s.driver.academy && s.career.series !== 'F1' && !s.flags.academyWarn,
  title: 'A call from the academy',
  text: (s, c) => `The ${c.academy} boss is blunt: "Top three in the championship, or we let you go."`,
  choices: [
    { label: '"You\'ll have it."', ok: { text: 'You hang up and stare at the wall for a while. No pressure, then.', fx: { flag: 'academyWarn', stats: { composure: 1 } } } },
    {
      label: 'Ask for more simulator time', stat: 'technical', base: 50,
      ok: { text: 'They agree. You use every minute.', fx: { flag: 'academyWarn', stats: { pace: 1, technical: 1 } } },
      ko: { text: '"Results first, then requests." Click.', fx: { flag: 'academyWarn' } },
    },
  ],
});

ev({
  id: 'poach',
  phase: 'between',
  w: (s, c) => (c.suitor ? 3 : 0),
  gap: 24,
  series: F1,
  when: (s) => s.career.role === 'race' && !s.flags.signFor,
  title: 'An invitation',
  text: (s, c) => `The ${c.suitor.name} team principal invites you for a "coffee" in their motorhome. Everybody in the paddock sees you walk in.`,
  choices: (s, c) => [
    { label: `Sign a pre-contract for next year`, ok: { text: `You sign. From next season, you drive for ${c.suitor.short}. For now, nobody can know. Everybody already knows.`, fx: { signFor: c.suitor.id, teamRel: -4 } } },
    {
      label: 'Use it to get a raise', stat: 'composure', base: 50,
      ok: { text: 'Your current team hears about the coffee and finds a lot more money very quickly.', fx: { salaryUp: 0.3, teamRel: -1 } },
      ko: { text: 'Your team calls your bluff. Relations are chilly.', fx: { teamRel: -6 } },
    },
    { label: 'Politely decline', ok: { text: 'Loyalty noted, and appreciated.', fx: { teamRel: 4 } } },
  ],
});

ev({
  id: 'extension',
  phase: 'between',
  w: (s, c) => (c.contractYears === 1 && s.driver.teamRel >= 60 ? 3 : 0),
  gap: 24,
  series: F1,
  when: (s) => s.career.role === 'race' && !s.flags.signFor,
  title: 'Early extension',
  text: (s, c) => `${c.team} want to tie you down early: two more years on top of this one.`,
  choices: [
    { label: 'Sign the extension', ok: { text: 'Pen, paper, photo, handshake. Job security in Formula 1 is a rare and beautiful thing.', fx: { extend: 2, teamRel: 5, salaryUp: 0.15 } } },
    { label: 'Wait and test the market', ok: { text: 'You smile and say you are "focused on this season". Everyone knows what that means.', fx: { teamRel: -2 } } },
  ],
});

ev({
  id: 'doc_crew',
  phase: 'between',
  once: true,
  w: 1.5,
  when: (s) => s.career.series === 'F1' || s.career.series === 'F2',
  title: 'Lights, camera',
  text: 'A streaming documentary crew wants to follow your season. Every argument, every tear, every bad haircut.',
  choices: [
    {
      label: 'Let them in', p: 60,
      ok: { text: 'You come across as funny and real. Your follower count triples.', fx: { fame: 7 } },
      ko: { text: 'They edit your one bad day into a full villain arc. You are, apparently, the bad guy now.', fx: { fame: 4, teamRel: -3 } },
    },
    { label: 'No cameras', ok: { text: 'Your privacy is intact. Your follower count is too.', fx: { stats: { composure: 1 } } } },
  ],
});

ev({
  id: 'engineer_poached',
  phase: 'between',
  once: true,
  w: 1.5,
  series: F1,
  when: (s) => s.career.role === 'race',
  title: 'Your engineer',
  text: (s, c) => `A rival team wants to poach your race engineer, ${c.eng}. You have built your whole radio shorthand together.`,
  choices: (s, c) => [
    { label: `Fight to keep ${c.eng}`, ok: { text: `You go to the team principal and make it personal. ${c.eng} stays, with a pay rise.`, fx: { teamRel: -1, stats: { technical: 1 } } } },
    { label: 'Let them go with your blessing', ok: { text: 'A hug, a farewell dinner and a new voice in your ear next week.', fx: { fame: 1 } } },
  ],
});

ev({
  id: 'esports',
  phase: 'between',
  once: true,
  w: 3,
  when: (s) => s.driver.bg === 'simracer',
  title: 'Back on the rig',
  text: 'Your old sim-racing league invites you to a charity stream. Your chat is still full of people who remember you as "KerbHopper99".',
  choices: [
    { label: 'Do the stream', ok: { text: 'Four hours, half a million viewers and a lot of money for charity. You still have it.', fx: { fame: 3, stats: { technical: 1 } } } },
    { label: 'You are a real racer now', ok: { text: 'Your chat calls you a sellout. Affectionately. Mostly.', fx: { stats: { composure: 1 } } } },
  ],
});

ev({
  id: 'kebab_return',
  phase: 'between',
  once: true,
  w: 4,
  series: F1,
  when: (s) => s.flags.kebab,
  title: 'An old friend',
  text: 'Dönerland Express, your very first sponsor, sends a letter in shaky handwriting. Could their spinning kebab go back on your helmet, just for one race?',
  choices: [
    { label: 'Of course it can', ok: { text: 'The spinning kebab returns. Merch sales explode. Dönerland opens three new branches.', fx: { fame: 4, flag: 'kebab_f1' } } },
    { label: 'The team says no', ok: { text: 'You send them a signed photo instead. It goes on the wall above the rotisserie.', fx: {} } },
  ],
});

ev({
  id: 'family_payback',
  phase: 'between',
  once: true,
  w: 4,
  when: (s) => s.flags.remortgage && s.driver.money >= 3000000,
  title: 'Paying it back',
  text: 'Your parents still live in the house they remortgaged so you could race karts. They would never ask for anything.',
  choices: [
    { label: 'Pay off the mortgage and buy them a new house', ok: { text: 'Your mum cries. Your dad pretends he has something in his eye. Best money you will ever spend.', fx: { money: -1500000, fame: 2, stats: { composure: 2 }, flag: 'paid_back' } } },
    { label: 'Later, when you are settled', ok: { text: 'They tell you not to worry. You worry.', fx: {} } },
  ],
});

ev({
  id: 'mountain_bike',
  phase: 'between',
  once: true,
  w: 1.5,
  title: 'Free weekend',
  text: 'A friend invites you mountain biking on the free weekend. Your contract has a clause about this. Probably.',
  choices: [
    {
      label: 'Go riding', stat: 'consistency', base: 60,
      ok: { text: 'Great fun, great cardio, zero injuries.', fx: { stats: { consistency: 1 } } },
      ko: { text: 'You go over the handlebars and break a collarbone. You will miss the next two races.', fx: { injury: 2, teamRel: -6 } },
    },
    { label: 'Play it safe', ok: { text: 'You play golf instead. Equally dangerous, just slower.', fx: {} } },
  ],
});

// ------------------------------------------------------ offseason

ev({
  id: 'gala',
  phase: 'offseason',
  w: (s, c) => (c.champion ? 6 : 0),
  title: 'The prize gala',
  text: 'Black tie, a trophy the size of a toddler and a speech you did not prepare.',
  choices: [
    { label: 'Thank the team, by name', ok: { text: 'You name every mechanic. It takes nine minutes. The team will run through walls for you.', fx: { teamRel: 6 } } },
    { label: 'Wing it with jokes', stat: 'composure', base: 50, ok: { text: 'The room is in stitches. The clip goes viral.', fx: { fame: 4 } }, ko: { text: 'Nobody laughs at the tyre pun. Long silence.', fx: { fame: -1 } } },
  ],
});

ev({
  id: 'retire_talk',
  phase: 'offseason',
  w: (s) => (s.driver.age >= 34 && s.career.series === 'F1' ? 5 : 0),
  gap: 0,
  when: (s) => !s.flags.farewell,
  title: 'The question',
  text: (s) => `You are ${s.driver.age}. Every press conference ends with the same question: "When will you retire?"`,
  choices: [
    { label: 'Announce next season will be your last', ok: { text: 'A farewell season. Every race a goodbye.', fx: { flag: 'farewell', fame: 3 } } },
    { label: '"When I stop being fast."', ok: { text: 'You are still fast. For now.', fx: { stats: { composure: 1 } } } },
  ],
});

ev({
  id: 'agent',
  phase: 'offseason',
  once: true,
  w: 2,
  when: (s) => s.career.series === 'F3' || s.career.series === 'F2',
  title: 'A super-agent',
  text: 'A super-agent with three phones and no visible blinking offers to manage your career. Fee: ten per cent of everything, forever.',
  choices: [
    { label: 'Sign with the agent', ok: { text: 'Your phone suddenly starts ringing with better offers.', fx: { flag: 'agent', fame: 2 } } },
    { label: 'Manage yourself', ok: { text: 'You keep a hundred per cent of a smaller pie.', fx: { stats: { composure: 1 } } } },
  ],
});

// ------------------------------------------------------ more race moments

ev({
  id: 'stall_grid',
  phase: 'race',
  w: 1.2,
  gap: 10,
  title: (s, c) => `${c.track}: on the grid`,
  text: 'Formation lap done. You select first gear, the revs drop, and the anti-stall kicks in just as the first red light comes on.',
  choices: [
    {
      label: 'Feather the clutch and save it', stat: 'technical', base: 50,
      ok: { text: 'You catch it with a flick of the paddle. Nobody even noticed.', fx: {} },
      ko: { text: 'You bog down and half the field streams past on both sides.', fx: { mod: -3 } },
    },
    {
      label: 'Dump it and pray', p: 35,
      ok: { text: 'Wheelspin, then grip, then glory. Best start of your life.', fx: { mod: 2 } },
      ko: { text: 'You stall. Completely. The marshals have to push you away.', fx: { mod: -5 } },
    },
  ],
  variants: [
    {
      text: (s, c) =>
        byKind(c, {
          street: 'Formation lap done. On a street circuit the grid is narrow and the walls are close, and of course this is when the revs drop and the anti-stall kicks in. First red light.',
          fast: 'Formation lap done. A long run to Turn 1 is a great place to gain places and a terrible place to stall. The revs drop. Anti-stall. First red light.',
          technical: 'Formation lap done. The clutch bite point has wandered, the revs drop, and the anti-stall kicks in just as the first red light comes on.',
        }),
      choices: [
        { ok: 'You catch it with a flick of the paddle and get away cleanly. Nobody noticed a thing.', ko: 'You bog down and the cars behind stream past on both sides.' },
        { ok: 'You dump the clutch, the rears bite, and you rocket off the line.', ko: 'You stall. Completely. The marshals wave yellow flags and push you away.' },
      ],
    },
    {
      when: (s, c) => c.wet,
      text: 'Standing water on the grid, a slippery clutch, and a car that does not want to take first gear. The anti-stall kicks in as the first red light comes on.',
      choices: [
        { ok: 'You feather it like a surgeon and get away cleanly in the spray.', ko: 'Wheelspin, then nothing. The field disappears into the spray ahead.' },
        { ok: 'You dump the clutch, the tyres find a dry patch, and the car hooks up. Rocket start.', ko: 'It bogs down in the wet and stalls. The cars behind swerve round you in the spray.' },
      ],
    },
    {
      when: (s, c) => c.grid <= 3,
      text: (s, c) => `P${c.grid}, right at the front, with the whole field lined up behind you. The revs drop, the anti-stall kicks in, and the first red light comes on.`,
      choices: [
        { ok: 'You catch it with a flick of the paddle. From the grandstands it looks like a perfect launch.', ko: 'You bog down at the front and the field streams past on both sides.' },
        { ok: 'You dump it and the car leaps forward like it was fired from a cannon.', ko: 'You stall at the front of the grid. Twenty cars dodge you, and the marshals push you away.' },
      ],
    },
  ],
});

ev({
  id: 'red_flag',
  phase: 'race',
  banner: 'red',
  w: 1.4,
  gap: 8,
  title: (s, c) => `${c.track}: red flag`,
  text: 'A big crash ahead and a barrier needs rebuilding. The cars file into the pit lane. Standing restart, fresh tyres for everyone, and a lot of nervous drivers.',
  choices: [
    {
      label: 'Nail the restart', stat: 'composure', base: 50,
      ok: { text: 'Perfect launch. You gain two places before the first corner.', fx: { mod: 2.5 } },
      ko: { text: 'Too much wheelspin. Swallowed up on the run to Turn 1.', fx: { mod: -2 } },
    },
    { label: 'Play it safe into Turn 1', ok: { text: 'You avoid the chaos and keep your position.', fx: { mod: 0.3 } } },
  ],
});

ev({
  id: 'unsafe_release',
  phase: 'race',
  w: 1.2,
  gap: 10,
  title: (s, c) => `${c.track}: pit lane`,
  text: 'The lollipop lifts and you are waved out straight into the path of another car arriving at the next box.',
  choices: [
    {
      label: 'Floor it', p: 55,
      ok: { text: 'You squeeze out ahead by a wheel. The stewards decide it was fine.', fx: { mod: 1 } },
      ko: { text: 'Unsafe release. Five-second penalty, and an apology to the team next door.', fx: { lose: 2 } },
    },
    { label: 'Give way', ok: { text: 'You wait half a second. Sensible, slow, legal.', fx: { mod: -0.8 } } },
  ],
});

ev({
  id: 'teammate_contact',
  phase: 'race',
  w: 2,
  gap: 12,
  when: (s, c) => c.tm && (c.tmAhead || c.tmBehind),
  title: (s, c) => `${c.track}: friendly fire`,
  text: (s, c) => `You and ${c.tm.last} bang wheels fighting over P${c.pos}. Both cars survive. On the pit wall, your team principal has their head in their hands.`,
  choices: [
    { label: 'Blame him on the radio', ok: { text: 'Every broadcaster plays your radio message on a loop. The team asks you both to "calm down".', fx: { teamRel: -4, fame: 2 } } },
    { label: 'Apologise in the debrief', ok: { text: 'Mature. The team appreciates it, even if your teammate pretends not to.', fx: { teamRel: 3 } } },
  ],
});

ev({
  id: 'drs_stuck',
  phase: 'race',
  series: F1,
  w: 1,
  gap: 14,
  title: (s, c) => `${c.track}: rear wing problem`,
  radio: (s, c) => `${c.eng}: "Your DRS is stuck open. Careful in the fast stuff."`,
  text: 'Faster on the straights, terrifying in the corners. Every high-speed turn now feels like a coin toss.',
  choices: [
    {
      label: 'Keep pushing', stat: 'consistency', base: 45,
      ok: { text: 'You adapt your lines and use the extra speed. It is almost an advantage.', fx: { mod: 1.5 } },
      ko: { text: 'A huge slide through the fast chicane costs you seconds and places.', fx: { mod: -3 } },
    },
    { label: 'Box to fix it', ok: { text: 'A long stop, but the wing closes properly again.', fx: { mod: -2 } } },
  ],
});

ev({
  id: 'engine_penalty',
  phase: 'race',
  series: F1,
  w: 1,
  gap: 24,
  title: (s, c) => `${c.track}: grid penalty`,
  radio: (s, c) => `${c.eng}: "We need a fresh power unit. Where do you want to take the penalty?"`,
  text: 'A new engine means a trip to the back of the grid. Your engineer thinks this track is a good place to overtake. You are not so sure.',
  choices: [
    { label: 'Take it here', ok: { text: 'You start near the back, but the fresh engine is a rocket on the straights.', fx: { qmod: -4, mod: 1.2 } } },
    {
      label: 'Push the old engine one more race', p: 65,
      ok: { text: 'It survives. Somehow it survives.', fx: {} },
      ko: { text: 'It does not survive. Smoke, flames, a long walk.', fx: { dnf: true } },
    },
  ],
});

ev({
  id: 'track_invader',
  phase: 'race',
  banner: 'sc',
  w: 0.6,
  gap: 40,
  title: (s, c) => `${c.track}: something on track`,
  text: 'A fan in a cow costume has climbed the fence and is jogging down the pit straight. Race control is, apparently, thinking about it.',
  choices: [
    { label: 'Give the cow a wave', ok: { text: 'A clip of you waving at a cow is the most-watched moment of the season.', fx: { fame: 3 } } },
    { label: 'Stay focused', ok: { text: 'You stare straight ahead. The cow is escorted off. You gain a place at the restart.', fx: { mod: 0.8 } } },
  ],
});

ev({
  id: 'wet_quali',
  phase: 'race',
  banner: 'rain',
  w: (s, c) => (c.wet ? 4 : 0),
  gap: 8,
  title: (s, c) => `${c.track}: wet qualifying`,
  text: 'Standing water, intermediate tyres and ten minutes left on the clock. The track could get better or much, much worse.',
  choices: [
    {
      label: 'Go out now', stat: 'wet', base: 52,
      ok: { text: 'You bank a lap before the next shower. It holds up for a great grid slot.', fx: { qmod: 3 } },
      ko: { text: 'You aquaplane at the first corner and abort the lap.', fx: { qmod: -2 } },
    },
    {
      label: 'Wait for the final minute', stat: 'wet', base: 42,
      ok: { text: 'The track dries just in time and your last lap is stunning.', fx: { qmod: 4, fame: 1 } },
      ko: { text: 'It rains harder. Your only lap is three seconds off.', fx: { qmod: -4 } },
    },
  ],
});

ev({
  id: 'grid_walk',
  phase: 'race',
  series: F1,
  w: 1,
  gap: 20,
  title: (s, c) => `${c.track}: the grid walk`,
  text: 'Ten minutes to the start. A famous TV pundit shoves a microphone in your face: "Is this make or break for you?"',
  choices: [
    {
      label: 'Laugh it off', stat: 'composure', base: 50,
      ok: { text: 'You crack a joke, the pundit laughs, and you walk to the car relaxed.', fx: { fame: 2 } },
      ko: { text: 'Your joke dies on live television. You think about it for the whole first stint.', fx: { fame: -1, mod: -0.8 } },
    },
    { label: 'Walk past without a word', ok: { text: 'Cold. Focused. The clip gets a million views anyway.', fx: { fame: 1 } } },
  ],
});

// ------------------------------------------------------ more off-track moments

ev({
  id: 'shoey',
  phase: 'between',
  w: (s, c) => (c.prev && !c.prev.dnf && c.prev.pos <= 3 ? 4 : 0),
  gap: 30,
  title: (s, c) => `${c.prev?.track || 'Podium'}: on the podium`,
  text: 'The race winner pours champagne into a sweaty race boot and holds it out to you. Thirty thousand people are watching.',
  choices: [
    { label: 'Do the shoey', ok: { text: 'The crowd goes wild. It tastes exactly how you expected.', fx: { fame: 3 } } },
    { label: 'Politely decline', ok: { text: 'You raise your bottle instead. Classy. Slightly boring.', fx: { stats: { composure: 1 } } } },
  ],
});

ev({
  id: 'trophy_drop',
  phase: 'between',
  once: true,
  w: (s, c) => (c.prev && !c.prev.dnf && c.prev.pos === 1 ? 3 : 0),
  title: 'The trophy',
  text: 'You lift the winner’s trophy above your head and the lid flies off and shatters on the podium.',
  choices: [
    {
      label: 'Pretend it was planned', stat: 'composure', base: 50,
      ok: { text: 'You strike a pose with the broken lid. It becomes the photo of the year.', fx: { fame: 3 } },
      ko: { text: 'You try to catch it, miss, and step on it. Twice.', fx: { fame: 1 } },
    },
    { label: 'Apologise to the organisers', ok: { text: 'They send you a replacement. It is slightly smaller.', fx: { fame: 1 } } },
  ],
});

ev({
  id: 'hot_mic',
  phase: 'between',
  w: 1.2,
  title: 'Live on air',
  text: 'Your radio rant about the stewards was broadcast live, swear words and all. The governing body has opinions.',
  choices: (s) => [
    { label: 'Stand by every word', ok: { text: `A ${s.career.series === 'F1' ? '€20,000' : 'small'} fine and a lot of new fans.`, fx: { fame: 3, money: -Math.min(s.driver.money, pay(s, 20000)), teamRel: -2 } } },
    { label: 'Apologise to the stewards', ok: { text: 'They accept. You are now on their nice list, for about a week.', fx: { teamRel: 1, stats: { composure: 1 } } } },
  ],
});

ev({
  id: 'team_takeover',
  phase: 'between',
  series: F1,
  once: true,
  w: 0.8,
  when: (s) => s.career.role === 'race',
  title: 'New owners',
  text: (s, c) => `A tech billionaire has bought ${c.team}. There is a press conference, a new logo, and a lot of talk about "disruption".`,
  choices: [
    { label: 'Welcome the new owner', ok: { text: 'The new owner likes you. The budget grows.', fx: { teamRel: 3, budget: 0.06 } } },
    {
      label: 'Ask about the budget, live on stage', stat: 'composure', base: 50,
      ok: { text: 'The owner promises a bigger budget on the spot. Everyone heard it.', fx: { fame: 2, budget: 0.1, carPerf: 0.5 } },
      ko: { text: 'Awkward silence. The owner does not forget.', fx: { teamRel: -5 } },
    },
  ],
});

ev({
  id: 'boss_fired',
  phase: 'between',
  series: F1,
  gap: 40,
  w: (s, c) => (c.struggling ? 3 : 0),
  when: (s) => s.career.role === 'race',
  title: 'The boss is gone',
  text: (s, c) => `${c.team} have fired their team principal after a string of bad results. The new boss wants a word with you before the next race.`,
  choices: [
    {
      label: 'Ask for number-one status', stat: 'composure', base: 45,
      ok: { text: 'The new boss agrees. The car is built around you from now on.', fx: { teamRel: 6, flag: 'numberOne' } },
      ko: { text: '"Earn it." Fair, but cold.', fx: { teamRel: -4 } },
    },
    { label: 'Promise to work harder than anyone', ok: { text: 'A firm handshake and a fresh start.', fx: { teamRel: 3 } } },
  ],
});

ev({
  id: 'fan_kid',
  phase: 'between',
  w: 1.2,
  title: 'At the paddock gate',
  text: 'A kid wearing a homemade cardboard copy of your helmet has waited outside the paddock gate for three hours.',
  choices: [
    { label: 'Give them your race gloves', ok: { text: 'They burst into tears. You very nearly do too.', fx: { fame: 3 } } },
    { label: 'Sign the cardboard helmet', ok: { text: 'They hold it up like a trophy all the way to the car park.', fx: { fame: 1 } } },
  ],
});

ev({
  id: 'kid_karting',
  phase: 'between',
  once: true,
  w: 3,
  when: (s) => s.flags.parent && s.driver.age >= 30,
  title: 'A family race',
  text: 'Your kid’s first ever kart race is on the same day as a sponsor event you are contractually obliged to attend.',
  choices: (s) => [
    { label: 'Skip the sponsor event', ok: { text: 'You stand at the fence and scream louder than any race engineer. They finish fourth. You are unbearably proud.', fx: { fame: -1, stats: { composure: 2 } } } },
    { label: 'Watch the stream from the hotel', ok: { text: 'You smile for the sponsor photos and watch on your phone under the table.', fx: { money: pay(s, 200000) } } },
  ],
});

ev({
  id: 'silly_season',
  phase: 'between',
  series: F1,
  w: (s, c) => (c.rumourTeam ? 1.2 : 0),
  gap: 30,
  when: (s) => s.career.role === 'race',
  title: 'Silly season',
  text: (s, c) => `Social media is convinced you are joining ${c.rumourTeam} next year. Someone has photoshopped you into their overalls.`,
  choices: [
    { label: 'Post a cryptic emoji', ok: { text: 'One emoji, eleven million views, and a very tense call from your team principal.', fx: { fame: 3, teamRel: -3 } } },
    { label: 'Shut the rumour down', ok: { text: '"I am happy here." Your team relaxes, a little.', fx: { teamRel: 3 } } },
  ],
});

ev({
  id: 'rookie_pranks',
  phase: 'preseason',
  w: 0,
  once: true,
  title: 'Welcome to Formula 1',
  text: 'Your first day in the F1 paddock. Your seat in the motorhome has been filled with three hundred rubber ducks.',
  choices: [
    { label: 'Laugh and line them up on the pit wall', ok: { text: 'The mechanics decide you are alright.', fx: { teamRel: 3, fame: 1 } } },
    {
      label: 'Plot your revenge', stat: 'composure', base: 50,
      ok: { text: 'By Friday every veteran’s helmet bag is full of ducks. Legend status, achieved.', fx: { fame: 3 } },
      ko: { text: 'Your revenge targets the team principal by mistake.', fx: { teamRel: -3, fame: 1 } },
    },
  ],
});

ev({
  id: 'number_one',
  phase: 'preseason',
  w: 0,
  title: 'The number one',
  text: (s, c) => `As world champion you have earned the right to run the number 1 on your car this year. Your #${c.number} is on a lot of merchandise, though.`,
  choices: (s, c) => [
    { label: 'Run the #1', ok: { text: 'A big gold 1 on the nose. Everyone knows who to beat.', fx: { useOne: true, fame: 2 } } },
    { label: `Keep the #${c.number}`, ok: { text: 'Your number is your brand. The merch team is relieved.', fx: { fame: 1 } } },
  ],
});

ev({
  id: 'charity_helmet',
  phase: 'between',
  once: true,
  w: 1,
  series: F1,
  title: 'Charity auction',
  text: 'A children’s hospital asks if you would donate one of your race helmets to its auction.',
  choices: [
    { label: 'Donate this year’s helmet', ok: { text: 'It sells for a ridiculous amount. You visit the ward with the cheque.', fx: { fame: 3 } } },
    { label: 'Send a signed cap', ok: { text: 'They are grateful. It raises enough for a new games console.', fx: { fame: 1 } } },
  ],
});

ev({
  id: 'simulator_record',
  phase: 'between',
  w: 1,
  title: 'Factory day',
  text: 'Between races you spend a day at the factory. Two hundred engineers stop working when you walk in.',
  choices: [
    { label: 'Thank every department in person', ok: { text: 'It takes six hours. The factory will remember it for years.', fx: { teamRel: 4 } } },
    {
      label: 'Hunt for a sim lap record', stat: 'pace', base: 55,
      ok: { text: 'You smash the simulator record. The data helps the car, too.', fx: { stats: { technical: 1 }, carPerf: 0.2 } },
      ko: { text: 'The test driver’s record stands. He is insufferable about it.', fx: {} },
    },
  ],
});

// ------------------------------------------------------ reserve seasons (content version 2)

const reserveTime = (s) => contentVersion(s) >= 2 && s.career.role === 'reserve';
// Between races the season has already moved on to the next round.
export const nextTrack = (s) => TRACKS[s.season?.cal[s.season.round]] || TRACKS[s.season?.cal[0]] || TRACKS.australia;
// The slowest other F1 team: the one most likely to gamble on a reserve.
export const smallTeam = (s) =>
  Object.values(s.teams)
    .filter((t) => t.series === 'F1' && t.id !== s.career.team)
    .sort((a, b) => a.perf - b.perf || (a.id < b.id ? -1 : 1))[0];

ev({
  id: 'reserve_fp1',
  phase: 'between',
  w: 2.5,
  when: reserveTime,
  title: (s) => `${nextTrack(s).short}: first practice`,
  text: (s, c) => `${c.team} are putting you in the car for first practice at ${nextTrack(s).short}. One hour, a race car, and a garage full of people quietly deciding whether you deserve one.`,
  choices: [
    {
      label: 'Chase a headline lap time', stat: 'pace', base: 50,
      ok: { text: 'Quickest of the stand-ins and faster than one of the race drivers. The team principal wanders over to your engineer.', fx: { fame: 2, teamRel: 2 } },
      ko: { text: 'You push too hard, spin at the hairpin and bring out a red flag. The driver who loses the session is not thrilled.', fx: { teamRel: -3 } },
    },
    { label: 'Run the test programme to the letter', ok: { text: 'Aero rakes, long runs, back-to-back tyre tests. Dull, valuable, and noticed.', fx: { stats: { technical: 1 }, teamRel: 2 } } },
  ],
});

ev({
  id: 'reserve_sim',
  phase: 'between',
  w: 2.5,
  when: reserveTime,
  title: 'Night shift',
  radio: (s, c) => `${c.eng}: "Can you stay on in the sim tonight? The car and the simulator disagree about everything."`,
  text: 'The race team flies out to the next round. You stay behind at the factory to make the simulator match last weekend\'s data. It will be a long night.',
  choices: [
    {
      label: 'Drive until the numbers match', stat: 'technical', base: 50,
      ok: { text: 'At four in the morning the simulator and the car finally agree. The race engineers find your notes waiting for them.', fx: { stats: { technical: 1 }, teamRel: 3 } },
      ko: { text: 'Six hundred laps, no correlation and a room full of very tired engineers. You learn a lot about what doesn\'t work.', fx: { stats: { technical: 1 } } },
    },
    { label: 'Do your hours and go home', ok: { text: 'A solid shift, then sleep. The data can wait for daylight.', fx: { stats: { composure: 1 } } } },
  ],
});

ev({
  id: 'reserve_seat_talk',
  phase: 'between',
  w: 2,
  when: reserveTime,
  title: 'The boss\'s office',
  text: (s, c) => `The ${c.team} team principal closes the door. "If a race seat opens up, you are on the list. I need to know you are ready."`,
  choices: [
    {
      label: 'Ask what it would take', stat: 'composure', base: 50,
      ok: { text: 'A straight answer: be quick on Fridays, be useful in the sim, embarrass nobody. You can do that.', fx: { teamRel: 4, stats: { composure: 1 } } },
      ko: { text: '"Results, not questions," says the boss. The meeting is over before you sit down.', fx: { teamRel: -2 } },
    },
    { label: 'Say you were ready yesterday', ok: { text: '"Good," says the boss. "Prove it." It feels like a door opening a crack.', fx: { fame: 1, teamRel: 2 } } },
  ],
});

ev({
  id: 'reserve_rival_call',
  phase: 'between',
  w: 2,
  when: (s) => reserveTime(s) && !!smallTeam(s),
  title: 'A quiet phone call',
  text: (s) => `Your phone buzzes at midnight. It is the team manager at ${smallTeam(s).name}: "Purely hypothetical, but would you ever drive for us?"`,
  choices: [
    { label: 'Tell your own team about it', ok: { text: 'Your team principal appreciates the honesty and suddenly finds a few more Friday sessions for you.', fx: { teamRel: 4 } } },
    {
      label: 'Keep it quiet and keep talking', stat: 'composure', base: 50,
      ok: { text: 'Nothing is signed, but your name is now on two lists. Word gets around the paddock, in a good way.', fx: { fame: 2 } },
      ko: { text: 'The paddock knows within a day. Your own team is not amused.', fx: { teamRel: -4, fame: 1 } },
    },
  ],
});

ev({
  id: 'reserve_rookie',
  phase: 'between',
  w: 2,
  when: reserveTime,
  title: 'The new kid',
  text: (s, c) => `A teenager from the ${c.team} junior programme is doing their first simulator day, and the engineers ask you to show them the ropes.`,
  choices: [
    { label: 'Spend the whole day with them', ok: { text: 'You share every trick you know. By the evening the kid is quicker than you were at that age. You don\'t mind. Much.', fx: { teamRel: 3, stats: { composure: 1 } } } },
    {
      label: 'Set them a lap time to beat', stat: 'pace', base: 55,
      ok: { text: 'They get within a tenth and spend the rest of the day trying to close it. So do you. Everyone gets faster.', fx: { stats: { pace: 1 } } },
      ko: { text: 'They beat your time on their third lap. The engineers are delighted. You are very quiet on the drive home.', fx: { stats: { composure: 1 } } },
    },
  ],
});

export const EVENTS = Object.fromEntries(L.map((e) => [e.id, e]));
