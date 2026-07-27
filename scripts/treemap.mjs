/**
 * Squarified treemap (Bruls, Huizing & van Wijk, 2000).
 *
 * Lays out weighted items in a rectangle, keeping each tile's aspect ratio as
 * close to 1 as possible so small repos stay readable instead of collapsing
 * into slivers. Returns tiles in the same order as the input items.
 */

export function squarify(items, rect) {
  const positive = items.filter((item) => item.value > 0);
  if (positive.length === 0) return [];

  const totalValue = positive.reduce((sum, item) => sum + item.value, 0);
  const totalArea = rect.width * rect.height;
  const scale = totalArea / totalValue;

  const queue = positive
    .map((item) => ({ ...item, area: item.value * scale }))
    .sort((a, b) => b.area - a.area);

  const tiles = [];
  let { x, y, width, height } = rect;
  let row = [];

  const rowLength = () => Math.min(width, height);
  const rowArea = (candidate) => candidate.reduce((sum, item) => sum + item.area, 0);

  const worst = (candidate) => {
    const length = rowLength();
    if (candidate.length === 0 || length === 0) return Infinity;
    const area = rowArea(candidate);
    const side = area / length;
    if (side === 0) return Infinity;
    return Math.max(
      ...candidate.map((item) => {
        const other = item.area / side;
        return Math.max(side / other, other / side);
      }),
    );
  };

  const flushRow = () => {
    const length = rowLength();
    const area = rowArea(row);
    const side = area / length;
    let offset = 0;

    for (const item of row) {
      const extent = item.area / side;
      if (width >= height) {
        tiles.push({ ...item, x, y: y + offset, width: side, height: extent });
      } else {
        tiles.push({ ...item, x: x + offset, y, width: extent, height: side });
      }
      offset += extent;
    }

    if (width >= height) {
      x += side;
      width -= side;
    } else {
      y += side;
      height -= side;
    }
    row = [];
  };

  for (const item of queue) {
    if (row.length === 0 || worst([...row, item]) <= worst(row)) {
      row.push(item);
    } else {
      flushRow();
      row.push(item);
    }
  }
  if (row.length > 0) flushRow();

  const order = new Map(tiles.map((tile) => [tile.key, tile]));
  return positive.map((item) => order.get(item.key)).filter(Boolean);
}
