# highcharts-to-echarts

A standalone, zero-dependency translation layer that converts [Highcharts](https://www.highcharts.com/) v4.1.1 (and v2.2+) configuration objects into [Apache ECharts](https://echarts.apache.org/) 5.x — enabling migration from Highcharts to ECharts **without rewriting any chart code**.

Includes a full **Highcharts API shim** so that `new Highcharts.Chart(config)` works out of the box. Just swap the script tags.

**[Live Demo — Side-by-side comparison (Highcharts vs ECharts)](https://jricardooliveira.github.io/highcharts-to-echarts/compare.html)**

## Quick Start

### Before (Highcharts)
```html
<script src="jquery.min.js"></script>
<script src="highcharts.js"></script>
```

### After (ECharts via wrapper)
```html
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
<script src="highcharts-to-echarts.js"></script>
```

That's it. Your existing `new Highcharts.Chart({ ... })` calls will render using ECharts automatically.

## How It Works

The wrapper intercepts Highcharts API calls and translates configuration objects in real time:

```
Highcharts Config  -->  [highcharts-to-echarts.js]  -->  ECharts Option  -->  ECharts Renderer
```

Every Highcharts option (title, axes, series, tooltip, legend, colors, stacking, etc.) is mapped to its ECharts equivalent. The output is a native ECharts instance, giving you access to the full ECharts ecosystem (themes, extensions, toolbox).

## Supported Chart Types

| Highcharts Type | ECharts Mapping | Notes |
|---|---|---|
| `line` | `line` | |
| `area` | `line` + `areaStyle` | |
| `spline` | `line` + `smooth` | |
| `areaspline` | `line` + `smooth` + `areaStyle` | |
| `column` | `bar` | Vertical bars |
| `bar` | `bar` + axis swap | Horizontal bars |
| `pie` | `pie` | |
| `pie` + `innerSize` | `pie` + `radius[]` | Donut chart |
| `scatter` | `scatter` | Auto-scaled axes |
| `bubble` | `scatter` + `symbolSize` | Size from z-value |

## Supported Features

### Configuration Options
- **Title & Subtitle** — text, alignment, styles
- **Axes** — categories, datetime/log/linear types, labels, gridlines, min/max, tick intervals, opposite (dual Y-axis)
- **Series** — all data formats (`[1,2,3]`, `[[x,y],...]`, `[{x,y,name,...}]`)
- **Stacking** — `normal` and `percent` modes
- **Tooltip** — shared/item trigger, crosshairs, formatter functions (best-effort adapter), template strings (`headerFormat`/`pointFormat`)
- **Legend** — layout, alignment, styling
- **Plot Options** — per-type and global series defaults with proper merge cascade
- **Colors** — custom palettes; defaults to the Highcharts v4.1.1 palette
- **Markers** — enabled/disabled, radius, symbol shapes
- **Dash Styles** — Solid, Dash, Dot, DashDot, and all variants
- **Data Labels** — enabled, format templates
- **Grid / Spacing** — margins, padding, background color
- **Animation** — on/off toggle

### Highcharts API Shim
The wrapper exposes a `Highcharts` global so existing code works without changes:

| API | Support |
|---|---|
| `new Highcharts.Chart(config)` | Full |
| `Highcharts.setOptions(opts)` | Full — merges into global defaults |
| `Highcharts.getOptions()` | Full |
| `Highcharts.charts[]` | Full — registry of all instances |
| `Highcharts.numberFormat()` | Full |
| `Highcharts.dateFormat()` | Basic (uses `toLocaleDateString`) |
| `Highcharts.version` | Returns `'4.1.1-compat'` |

### Explicit API
You can also use the wrapper directly without the shim:

```js
// Pure conversion — returns an ECharts option object
var option = HighchartsCompat.convert(highchartsConfig);

// Render — returns an ECharts instance
var chart = HighchartsCompat.chart('container', highchartsConfig);
```

## Visual Comparison

Open `compare.html` in a browser to see 15 chart types rendered side-by-side: native Highcharts on the left, ECharts via the wrapper on the right.

```bash
# Serve locally (required for Highcharts to load)
python3 -m http.server 8091
open http://localhost:8091/compare.html
```

### Test Charts
1. Basic Line (categories)
2. Stacked Area
3. Spline (smooth line, dash styles)
4. Column Chart
5. Stacked Column
6. Horizontal Bar (axis swap)
7. Pie Chart
8. Donut Chart (innerSize)
9. Scatter Chart (auto-scaled axes)
10. Bubble Chart
11. Combo (Column + Line, dual Y-axis)
12. Percent Stacked Column
13. Custom Tooltip Formatter
14. Custom Colors + Legend Disabled
15. Area Spline

## Styling Fidelity

The wrapper replicates Highcharts' default visual style:

- **Color palette** — exact Highcharts v4.1.1 defaults (`#7cb5ec`, `#434348`, ...)
- **Font family** — Lucida Grande, Verdana, Arial (Highcharts default stack)
- **Title** — centered, bold 18px, `#333`
- **Subtitle** — centered, 12px, `#666`
- **Axis labels** — 11px, `#666`
- **Axis lines & ticks** — `#ccd6eb`
- **Y-axis gridlines** — `#e6e6e6` (X-axis gridlines off by default)
- **Legend** — bottom-center, horizontal
- **Background** — white
- **Stack order** — matches Highcharts visual stacking direction
- **Bar chart category order** — top-to-bottom (matching Highcharts)

## Known Limitations

1. **Tooltip formatter functions** — A best-effort adapter wraps Highcharts formatters by constructing a pseudo `this` context (`this.x`, `this.y`, `this.series.name`, `this.points`, `this.color`). Complex formatters accessing deep Highcharts internals may not work.
2. **Highcharts events** — `plotOptions.series.events.click` etc. are not mapped. Use `instance.on('click', ...)` on the returned ECharts instance.
3. **Drilldown** — Not supported (Highcharts module feature).
4. **Axis plotLines/plotBands** — Partial support.
5. **Custom SVG renderer** — No equivalent in ECharts.
6. **Highmaps** — Not supported.
7. **Highcharts instance methods** — Methods like `chart.addSeries()`, `chart.setTitle()`, `chart.redraw()` are ECharts methods on the returned instance, not Highcharts methods.

## File Structure

```
highcharts-to-echarts.js  — The translation layer + Highcharts API shim (single file, no build)
compare.html              — Side-by-side visual comparison (Highcharts vs ECharts)
test.html                 — ECharts-only test harness (15 charts)
vendor/highcharts/        — Local Highcharts v4.1.1 files (for comparison page only)
```

## Browser Support

Works in any browser that supports ECharts 5.x (all modern browsers, IE11 with polyfills).

## License

MIT
