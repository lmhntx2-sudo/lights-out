// Circuits. `ot` is how easy overtaking is (0 = Monaco, 1 = anything goes),
// `rain` is the chance of a wet race, `sc` the chance of a safety car.

const T = (id, name, short, place, nat, laps, ot, rain, sc, kind) => ({ id, name, short, place, nat, laps, ot, rain, sc, kind });

export const TRACKS = Object.fromEntries(
  [
    T('australia', 'Australian Grand Prix', 'Australia', 'Melbourne', 'AU', 58, 0.45, 0.15, 0.55, 'street'),
    T('china', 'Chinese Grand Prix', 'China', 'Shanghai', 'CN', 56, 0.6, 0.2, 0.35, 'technical'),
    T('japan', 'Japanese Grand Prix', 'Japan', 'Suzuka', 'JP', 53, 0.35, 0.25, 0.3, 'fast'),
    T('bahrain', 'Bahrain Grand Prix', 'Bahrain', 'Sakhir', 'BH', 57, 0.7, 0.01, 0.3, 'technical'),
    T('saudi', 'Saudi Arabian Grand Prix', 'Saudi Arabia', 'Jeddah', 'SA', 50, 0.55, 0.01, 0.6, 'street'),
    T('miami', 'Miami Grand Prix', 'Miami', 'Miami Gardens', 'US', 57, 0.5, 0.2, 0.4, 'street'),
    T('canada', 'Canadian Grand Prix', 'Canada', 'Montréal', 'CA', 70, 0.6, 0.25, 0.6, 'street'),
    T('monaco', 'Monaco Grand Prix', 'Monaco', 'Monte Carlo', 'MC', 78, 0.05, 0.15, 0.5, 'street'),
    T('spain', 'Barcelona Grand Prix', 'Barcelona', 'Montmeló', 'ES', 66, 0.35, 0.08, 0.2, 'technical'),
    T('austria', 'Austrian Grand Prix', 'Austria', 'Spielberg', 'AT', 71, 0.6, 0.25, 0.3, 'fast'),
    T('britain', 'British Grand Prix', 'Britain', 'Silverstone', 'GB', 52, 0.5, 0.35, 0.35, 'fast'),
    T('belgium', 'Belgian Grand Prix', 'Belgium', 'Spa-Francorchamps', 'BE', 44, 0.65, 0.45, 0.4, 'fast'),
    T('hungary', 'Hungarian Grand Prix', 'Hungary', 'Budapest', 'HU', 70, 0.2, 0.12, 0.25, 'technical'),
    T('netherlands', 'Dutch Grand Prix', 'Netherlands', 'Zandvoort', 'NL', 72, 0.2, 0.25, 0.35, 'technical'),
    T('italy', 'Italian Grand Prix', 'Italy', 'Monza', 'IT', 53, 0.6, 0.12, 0.3, 'fast'),
    T('madrid', 'Spanish Grand Prix', 'Madrid', 'Madrid', 'ES', 57, 0.4, 0.05, 0.5, 'street'),
    T('baku', 'Azerbaijan Grand Prix', 'Baku', 'Baku', 'AZ', 51, 0.6, 0.03, 0.65, 'street'),
    T('singapore', 'Singapore Grand Prix', 'Singapore', 'Marina Bay', 'SG', 62, 0.2, 0.3, 0.75, 'street'),
    T('usa', 'United States Grand Prix', 'Austin', 'Austin', 'US', 56, 0.6, 0.1, 0.3, 'technical'),
    T('mexico', 'Mexico City Grand Prix', 'Mexico', 'Mexico City', 'MX', 71, 0.5, 0.1, 0.35, 'technical'),
    T('brazil', 'São Paulo Grand Prix', 'Brazil', 'Interlagos', 'BR', 71, 0.7, 0.4, 0.55, 'technical'),
    T('vegas', 'Las Vegas Grand Prix', 'Las Vegas', 'The Strip', 'US', 50, 0.65, 0.02, 0.45, 'street'),
    T('qatar', 'Qatar Grand Prix', 'Qatar', 'Lusail', 'QA', 57, 0.45, 0.01, 0.35, 'fast'),
    T('abudhabi', 'Abu Dhabi Grand Prix', 'Abu Dhabi', 'Yas Marina', 'AE', 58, 0.45, 0.01, 0.3, 'technical'),
    // Junior-formula venues
    T('misano', 'Misano round', 'Misano', 'Misano Adriatico', 'IT', 18, 0.5, 0.2, 0.3, 'technical'),
    T('vallelunga', 'Vallelunga round', 'Vallelunga', 'Campagnano di Roma', 'IT', 18, 0.45, 0.2, 0.3, 'technical'),
    T('mugello', 'Mugello round', 'Mugello', 'Scarperia', 'IT', 16, 0.55, 0.2, 0.25, 'fast'),
    T('imola', 'Imola round', 'Imola', 'Imola', 'IT', 18, 0.3, 0.3, 0.35, 'technical'),
    T('paulricard', 'Paul Ricard round', 'Le Castellet', 'Le Castellet', 'FR', 18, 0.6, 0.1, 0.2, 'fast'),
    T('hockenheim', 'Hockenheim round', 'Hockenheim', 'Hockenheim', 'DE', 18, 0.65, 0.25, 0.3, 'fast'),
    // Special events: on no calendar, raced by invitation, worth no points.
    { ...T('macau', 'Macau Grand Prix', 'Macau', 'Guia Circuit', 'MO', 15, 0.3, 0.12, 0.7, 'street'), special: true },
  ].map((t) => [t.id, t]),
);

export const CALENDARS = {
  F1: [
    'australia', 'china', 'japan', 'bahrain', 'saudi', 'miami', 'canada', 'monaco',
    'spain', 'austria', 'britain', 'belgium', 'hungary', 'netherlands', 'italy', 'madrid',
    'baku', 'singapore', 'usa', 'mexico', 'brazil', 'vegas', 'qatar', 'abudhabi',
  ],
  F2: ['australia', 'bahrain', 'saudi', 'monaco', 'spain', 'austria', 'britain', 'belgium', 'hungary', 'italy', 'baku', 'abudhabi'],
  F3: ['australia', 'bahrain', 'monaco', 'spain', 'austria', 'britain', 'belgium', 'hungary', 'italy', 'madrid'],
  F4: ['misano', 'imola', 'vallelunga', 'mugello', 'austria', 'paulricard', 'hockenheim', 'italy'],
};
