import { describe, expect, it } from 'vitest';
import { CLIMB_MAP } from '../../../../data/progression/climb-map';
import { MENU } from '../../../../data/common/menu-layout';
import {
  LAYER_PX,
  edgeAlpha,
  heightToY,
  layersInBand,
  offsetForCentre,
  ribbonHeight,
  roomScale,
  spreadMarks,
  visibleSlice,
  windowContentHeight,
} from './climb-map-layout';

describe('climb map layout', () => {
  it('turns a height into a strip y, the top of the strip being the top layer', () => {
    expect(heightToY(120, 120)).toBe(0);
    expect(heightToY(0, 120)).toBe(120 * LAYER_PX);
    expect(heightToY(47, 120)).toBe(73 * LAYER_PX);
  });

  it('cuts a span to the view', () => {
    const view = { top: 100, bottom: 500 };
    expect(visibleSlice({ top: 0, bottom: 90 }, view)).toBeNull();
    expect(visibleSlice({ top: 500, bottom: 600 }, view)).toBeNull();
    expect(visibleSlice({ top: 50, bottom: 300 }, view)).toEqual({ top: 100, bottom: 300 });
    expect(visibleSlice({ top: 300, bottom: 800 }, view)).toEqual({ top: 300, bottom: 500 });
    expect(visibleSlice({ top: 200, bottom: 300 }, view)).toEqual({ top: 200, bottom: 300 });
  });

  it('fades an object out towards the edges of the view', () => {
    const view = { top: 0, bottom: 1000 };
    expect(edgeAlpha({ top: 400, bottom: 500 }, view, 60)).toBe(1);
    expect(edgeAlpha({ top: 30, bottom: 130 }, view, 60)).toBe(0.5);
    expect(edgeAlpha({ top: -20, bottom: 80 }, view, 60)).toBe(0);
    expect(edgeAlpha({ top: 900, bottom: 970 }, view, 60)).toBe(0.5);
    expect(edgeAlpha({ top: 950, bottom: 1030 }, view, 60)).toBe(0);
  });

  it('moves marks apart upwards and keeps free ones where they are', () => {
    expect(spreadMarks([], 80)).toEqual([]);
    expect(spreadMarks([1000, 600, 200], 80)).toEqual([1000, 600, 200]);
    expect(spreadMarks([1000, 980, 970], 80)).toEqual([1000, 920, 840]);
    expect(spreadMarks([1000, 900, 500], 80)).toEqual([1000, 900, 500]);
  });

  it('centres a y in the view within the strip', () => {
    expect(offsetForCentre(1000, 400, 3000)).toBe(800);
    expect(offsetForCentre(50, 400, 3000)).toBe(0);
    expect(offsetForCentre(2990, 400, 3000)).toBe(2600);
    expect(offsetForCentre(100, 400, 300)).toBe(0);
  });

  it('counts the layers of a band the tower fills', () => {
    const band = { from: 21, to: 40 };
    expect(layersInBand(band, 0)).toBe(0);
    expect(layersInBand(band, 20)).toBe(0);
    expect(layersInBand(band, 31.5)).toBe(11.5);
    expect(layersInBand(band, 47)).toBe(20);
  });

  it('fills the safe frame with the window, less under an island', () => {
    const popup = MENU.popup;
    const half = MENU.style.ribbon.height / 2;
    const frame = 1919;
    expect(windowContentHeight(frame, 0)).toBe(
      frame - popup.screenMargin * 2 - half * 2 - popup.titleSpace - popup.padBottom,
    );
    expect(windowContentHeight(frame, 120)).toBe(
      frame - popup.screenMargin * 2 - half - popup.titleSpace - popup.padBottom,
    );
    expect(windowContentHeight(10, 0)).toBe(popup.minContentHeight);
  });

  it('leaves the ribbon what the goal row and appended rows do not take', () => {
    const goal = CLIMB_MAP.goal;
    expect(ribbonHeight(1500)).toBe(1500 - goal.height - goal.gap);
    expect(ribbonHeight(1500, [100])).toBe(1500 - goal.height - goal.gap - 100 - goal.gap);
    expect(ribbonHeight(50)).toBe(0);
  });

  it('fits a text to its room with no lower bound, however long it is', () => {
    expect(roomScale(0, 100)).toBe(1);
    expect(roomScale(80, 100)).toBe(1);
    expect(roomScale(200, 100)).toBe(0.5);
    // A very long name still ends inside the room: 1000 px of text in 184 px.
    const scale = roomScale(1000, 184);
    expect(scale * 1000).toBeCloseTo(184);
    expect(roomScale(50, -10)).toBe(0);
  });
});
