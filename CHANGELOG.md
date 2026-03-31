# Changelog

## 1.0.0 (2026-03-31)

### Initial Release

**Goal:** Replace Highcharts v4.1.1 (~1000 EUR/year license) with Apache ECharts 5.x (free, open-source) on the v3 engagement platform, with zero frontend code changes required.

### What was built

A standalone vanilla JS translation layer (`highcharts-to-echarts.js`) that:

1. **Converts Highcharts configs to ECharts options** — a pure `convert()` function translates every major Highcharts configuration option to its ECharts equivalent
2. **Provides a Highcharts API shim** — `new Highcharts.Chart(config)` works without any code changes. Also shims `Highcharts.setOptions()`, `Highcharts.charts[]`, `Highcharts.numberFormat()`, etc.
3. **Matches Highcharts visual defaults** — same color palette, font family, gridlines, legend position, axis styling

### Supported chart types
- Line, Area, Spline, Area Spline
- Column, Bar (horizontal, with axis swap)
- Pie, Donut (with custom labels, connectors, selection)
- Scatter, Bubble (with auto-scaled axes)
- Funnel
- World Map / Choropleth (with colorAxis → visualMap)
- Combo charts (e.g. Column + Line with dual Y-axis)

### Supported features
- Stacking: normal and percent (with data normalization)
- Dual Y-axis with opposite positioning
- Tooltip: shared/item trigger, crosshairs, formatter function adapter, template strings
- Legend: layout, alignment, styling
- PlotOptions cascade: `plotOptions.series` → `plotOptions[type]` → individual series
- Data formats: `[1,2,3]`, `[[x,y],...]`, `[{x,y,name,...}]`, `[{name,y}]` for pie
- Markers, dash styles, data labels
- Custom color palettes
- Animation toggle
- colorAxis for maps

### Styling fidelity
- Highcharts v4.1.1 default palette: `#7cb5ec, #434348, #90ed7d, #f7a35c, #8085e9, #f15c80, #e4d354, #2b908f, #f45b5b, #91e8e1`
- Font: Lucida Grande, Verdana, Arial
- Title: centered, bold 18px, #333
- Subtitle: 12px, #666
- Axis labels: 11px, #666
- Y-axis gridlines: #e6e6e6 (X-axis off by default)
- Axis lines/ticks: #ccd6eb
- Legend: bottom-center, horizontal
- Background: white
- Stacked series: reversed order to match Highcharts visual stacking
- Bar chart categories: top-to-bottom (inverted to match Highcharts)

### Known limitations
1. Tooltip formatter functions — best-effort adapter, complex ones accessing deep HC internals may break
2. Highcharts events (`plotOptions.series.events`) — not mapped; use `instance.on()` post-render
3. Drilldown — not supported
4. Axis plotLines/plotBands — partial support
5. Custom SVG renderer — no equivalent
6. Highmaps — basic choropleth works; advanced features (drill-down, navigation buttons) not supported
7. Highcharts instance methods (addSeries, setTitle, redraw) — not shimmed; the returned object is an ECharts instance

### Files
- `highcharts-to-echarts.js` — The translation layer + Highcharts API shim (~1000 lines, single IIFE, no dependencies)
- `compare.html` — Side-by-side comparison: 18 charts with native Highcharts on left, ECharts via wrapper on right
- `test.html` — ECharts-only test harness
- `vendor/highcharts/` — Local Highcharts v4.1.1 files (for comparison page only)

### How to migrate
```html
<!-- Remove these -->
<script src="jquery.min.js"></script>
<script src="highcharts.js"></script>

<!-- Add these -->
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
<script src="highcharts-to-echarts.js"></script>
```

No other code changes required.
