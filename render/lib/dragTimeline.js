/**
 * 「拖消」成片的确定性时间线。
 * 节奏按参考视频：单消 → 单消 → 双消收尾，分数和 Combo 递进。
 */

export const INITIAL_ROWS = [
  '######..',
  '######..',
  '.##.####',
  '#######.',
  '#.##.###',
  '##.#####',
  '###..###',
  '#####.##',
];

/** 形状用相对格坐标 [行偏移, 列偏移] 描述 */
export const SHAPES = {
  domino: [
    [0, 0],
    [0, 1],
  ],
  single: [[0, 0]],
  square: [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ],
};

/**
 * 每一步：从托盘哪个槽位拿、落到哪、几秒开始。
 * 时序单位是秒，pick→hover→drop 三段构成一次拖拽。
 */
export const MOVES = [
  {
    name: 'domino',
    cells: SHAPES.domino,
    row: 6,
    col: 3,
    slot: 1,
    pickAt: 2.6,
    dropAt: 4.5,
  },
  {
    name: 'single',
    cells: SHAPES.single,
    row: 3,
    col: 7,
    slot: 0,
    pickAt: 7.2,
    dropAt: 8.9,
  },
  {
    name: 'square',
    cells: SHAPES.square,
    row: 0,
    col: 6,
    slot: 2,
    pickAt: 11.8,
    dropAt: 13.9,
  },
];

/** 托盘里三个槽位初始各摆什么（被拿走后留空） */
export const TRAY = [SHAPES.single, SHAPES.domino, SHAPES.square];

export const DURATION = 21.5;
export const FPS = 30;

/** 落块回弹、消除扫描、碎屑存活等时长，多处引用所以集中放这 */
export const TIMING = {
  dropFall: 0.34,
  dropSettle: 0.26,
  clearDelayPerCell: 0.028,
  clearFlash: 0.18,
  debrisLife: 1.15,
  scoreRoll: 0.6,
};
