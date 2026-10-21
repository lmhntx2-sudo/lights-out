// Teams are fictional, but the paddock will look familiar. Swap names and
// colours here if you want a different grid.
//   perf      car performance at the start of 2026 (0-100)
//   budget    how well funded the team is (drives development)
//   prestige  how attractive a seat is
//   rel       reliability (chance a car finishes before driver errors)

export const F1_TEAMS = [
  { id: 'rossa', name: 'Scuderia Rossa', short: 'Rossa', color: '#E8002D', nat: 'IT', perf: 87, budget: 0.97, prestige: 100, rel: 0.965, academy: 'Rossa Driver Academy' },
  { id: 'silverline', name: 'Silverline Grand Prix', short: 'Silverline', color: '#27F4D2', nat: 'DE', perf: 91, budget: 0.96, prestige: 94, rel: 0.975, academy: 'Silverline Junior Team' },
  { id: 'torque', name: 'Torque Energy Racing', short: 'Torque', color: '#3671C6', nat: 'AT', perf: 88, budget: 0.95, prestige: 92, rel: 0.965, academy: 'Torque Junior Programme', sister: 'torquejr' },
  { id: 'papaya', name: 'Papaya Racing', short: 'Papaya', color: '#FF8000', nat: 'GB', perf: 90, budget: 0.93, prestige: 90, rel: 0.97, academy: 'Papaya Young Drivers' },
  { id: 'emerald', name: 'Emerald Racing', short: 'Emerald', color: '#229971', nat: 'GB', perf: 80, budget: 0.92, prestige: 78, rel: 0.955 },
  { id: 'grove', name: 'Grove Racing', short: 'Grove', color: '#64C4FF', nat: 'GB', perf: 81, budget: 0.78, prestige: 80, rel: 0.955 },
  { id: 'torquejr', name: 'Torque Junior', short: 'Torque Jr', color: '#6692FF', nat: 'IT', perf: 79, budget: 0.72, prestige: 66, rel: 0.955, sister: 'torque' },
  { id: 'audax', name: 'Audax Motorsport', short: 'Audax', color: '#A9B4C2', nat: 'DE', perf: 77, budget: 0.88, prestige: 70, rel: 0.94 },
  { id: 'haven', name: 'Haven Racing', short: 'Haven', color: '#F2F2F2', nat: 'US', perf: 77, budget: 0.7, prestige: 62, rel: 0.945 },
  { id: 'azur', name: 'Azur F1 Team', short: 'Azur', color: '#FF87BC', nat: 'FR', perf: 75, budget: 0.8, prestige: 70, rel: 0.94 },
  { id: 'crest', name: 'Crest Motors', short: 'Crest', color: '#C9A227', nat: 'US', perf: 72, budget: 0.85, prestige: 60, rel: 0.93 },
];

export const ACADEMY_TEAMS = ['rossa', 'silverline', 'torque', 'papaya'];

// Junior-formula outfits. Each series draws 11 of these.
export const FEEDER_TEAMS = [
  { name: 'Prima Racing', color: '#D7263D' },
  { name: 'Arte Grand Prix', color: '#2F5DA8' },
  { name: 'Tridente', color: '#7FB3D5' },
  { name: 'HyperTech GP', color: '#EDEDED' },
  { name: 'Valencia Motorsport', color: '#F2C14E' },
  { name: 'Van Dijkstra Racing', color: '#FF7F11' },
  { name: 'Rodan Motorsport', color: '#2E86AB' },
  { name: 'MV Racing', color: '#C2457A' },
  { name: 'Dorian Racing', color: '#3BB273' },
  { name: 'Jensen Motorsport', color: '#E4572E' },
  { name: 'Aix Racing', color: '#9DA3A4' },
  { name: 'Kartbahn Junior', color: '#5C80BC' },
  { name: 'Monoposto Lab', color: '#E9D758' },
  { name: 'Northern Lights GP', color: '#4ECDC4' },
];

export const ENGINEERS = ['Hannah', 'Pietro', 'Bianca', 'Raj', 'Sofia', 'Gus', 'Ines', 'Kenji', 'Olly', 'Ruth', 'Dani', 'Mika', 'Tomasz', 'Leah', 'Bernd', 'Carla'];
