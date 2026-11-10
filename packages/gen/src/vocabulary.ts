/** Words for activity names and WBS nodes, by sector. Plain ASCII so the files are safe in any encoding. */
export type Sector = 'rail' | 'highways' | 'solar' | 'flood';

export const SECTORS: Sector[] = ['rail', 'highways', 'solar', 'flood'];

interface Vocabulary {
  project: string;
  projectName: string;
  area: string;
  /** [short code, name] pairs, in the order the work happens. */
  disciplines: [string, string][];
  verbs: string[];
  /** Verbs for work that runs around the clock. */
  waits: string[];
  objects: string[];
}

const VERBS = [
  'Install',
  'Excavate',
  'Pour',
  'Inspect',
  'Commission',
  'Survey',
  'Fabricate',
  'Test',
  'Backfill',
  'Erect',
  'Set out',
  'Deliver',
];
const WAITS = ['Cure', 'Monitor', 'Dewater'];

export const VOCABULARY: Record<Sector, Vocabulary> = {
  rail: {
    project: 'RAIL',
    projectName: 'Rail upgrade programme',
    area: 'Section',
    disciplines: [
      ['ENB', 'Enabling works'],
      ['CIV', 'Civils'],
      ['TRK', 'Track'],
      ['OLE', 'Overhead line'],
      ['SIG', 'Signalling'],
      ['TEL', 'Telecoms'],
      ['STN', 'Stations'],
      ['TST', 'Testing and commissioning'],
    ],
    verbs: VERBS,
    waits: WAITS,
    objects: [
      'track panels',
      'ballast',
      'sleepers',
      'mast foundations',
      'catenary',
      'signal gantry',
      'cable troughing',
      'points machine',
      'platform edge',
      'drainage run',
      'retaining wall',
      'location cabinet',
    ],
  },
  highways: {
    project: 'HWY',
    projectName: 'Highway improvement scheme',
    area: 'Chainage zone',
    disciplines: [
      ['ENB', 'Enabling works'],
      ['ERW', 'Earthworks'],
      ['DRN', 'Drainage'],
      ['STR', 'Structures'],
      ['PAV', 'Pavement'],
      ['VRS', 'Barriers'],
      ['LGT', 'Lighting and signs'],
      ['FIN', 'Finishing'],
    ],
    verbs: VERBS,
    waits: WAITS,
    objects: [
      'sub-base',
      'binder course',
      'surface course',
      'kerbs',
      'gullies',
      'carrier drain',
      'bridge deck',
      'abutment',
      'safety barrier',
      'gantry base',
      'lighting columns',
      'embankment',
    ],
  },
  solar: {
    project: 'SOLAR',
    projectName: 'Solar farm',
    area: 'Block',
    disciplines: [
      ['ENB', 'Enabling works'],
      ['CIV', 'Civils'],
      ['PIL', 'Piling'],
      ['MNT', 'Mounting'],
      ['MOD', 'Modules'],
      ['DCE', 'DC electrical'],
      ['ACE', 'AC electrical'],
      ['TST', 'Testing and commissioning'],
    ],
    verbs: VERBS,
    waits: WAITS,
    objects: [
      'piles',
      'tracker tables',
      'module strings',
      'combiner boxes',
      'inverter skid',
      'cable trench',
      'transformer',
      'access track',
      'perimeter fence',
      'earthing grid',
      'switchgear',
      'CCTV masts',
    ],
  },
  flood: {
    project: 'FLOOD',
    projectName: 'Flood alleviation scheme',
    area: 'Reach',
    disciplines: [
      ['ENB', 'Enabling works'],
      ['ERW', 'Earthworks'],
      ['PIL', 'Sheet piling'],
      ['STR', 'Structures'],
      ['CHN', 'Channel works'],
      ['MEC', 'Mechanical and electrical'],
      ['LND', 'Landscaping'],
      ['TST', 'Testing and commissioning'],
    ],
    verbs: VERBS,
    waits: WAITS,
    objects: [
      'flood wall',
      'embankment',
      'sheet piles',
      'culvert',
      'outfall',
      'penstock',
      'pump station slab',
      'channel lining',
      'rock armour',
      'access ramp',
      'fish pass',
      'planting',
    ],
  },
};
