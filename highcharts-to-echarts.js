/**
 * HighchartsCompat — Highcharts v4.1.1 to Apache ECharts 5.x Translation Layer
 * Version: 1.0.0
 *
 * Provides a drop-in replacement for Highcharts v4.1.1 (and earlier v2.2+ configs).
 * Includes a Highcharts API shim so existing code using `new Highcharts.Chart(config)`
 * works without any code changes — just swap the script tags.
 *
 * Before:
 *   <script src="jquery.min.js"></script>
 *   <script src="highcharts.js"></script>
 *
 * After:
 *   <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
 *   <script src="highcharts-to-echarts.js"></script>
 *
 * Also available as explicit API:
 *   var option = HighchartsCompat.convert(highchartsConfig);
 *   var chart = HighchartsCompat.chart('container', highchartsConfig);
 *
 * Supported chart types: line, area, spline, areaspline, column, bar, pie, donut, scatter, bubble
 * Supported features: stacking (normal/percent), dual y-axis, tooltip formatters,
 *   markers, dash styles, data labels, custom palettes, legend configuration
 *
 * Known Limitations:
 *   1. Tooltip formatter functions — best-effort adapter; complex formatters may break
 *   2. Highcharts events (plotOptions.series.events) — not mapped; use instance.on() post-render
 *   3. Drilldown — not supported
 *   4. Axis plotLines/plotBands — partial support via markLine/markArea
 *   5. Custom SVG renderer features — no equivalent in ECharts
 *   6. Highmaps — not supported
 */
(function (global) {
  'use strict';

  // ============================================================
  // Section 1: Utilities
  // ============================================================

  function isArray(v) { return Array.isArray(v); }
  function isObject(v) { return v !== null && typeof v === 'object' && !isArray(v); }
  function isString(v) { return typeof v === 'string'; }
  function isFunction(v) { return typeof v === 'function'; }
  function isNumber(v) { return typeof v === 'number' && isFinite(v); }

  function deepMerge(target) {
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i];
      if (!isObject(src)) continue;
      for (var key in src) {
        if (!src.hasOwnProperty(key)) continue;
        var val = src[key];
        if (isObject(val) && isObject(target[key])) {
          target[key] = deepMerge({}, target[key], val);
        } else {
          target[key] = val;
        }
      }
    }
    return target;
  }

  function get(obj, path, defaultVal) {
    if (!obj) return defaultVal;
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return defaultVal;
      cur = cur[parts[i]];
    }
    return cur !== undefined ? cur : defaultVal;
  }

  function cssToEchartsTextStyle(hcStyle) {
    if (!hcStyle) return undefined;
    var style = {};
    if (hcStyle.color) style.color = hcStyle.color;
    if (hcStyle.fontSize) {
      style.fontSize = parseInt(String(hcStyle.fontSize), 10);
    }
    if (hcStyle.fontWeight) style.fontWeight = hcStyle.fontWeight;
    if (hcStyle.fontFamily) style.fontFamily = hcStyle.fontFamily;
    return style;
  }

  function resolveContainer(containerOrId) {
    if (!containerOrId) return null;
    if (isString(containerOrId)) {
      return document.getElementById(containerOrId);
    }
    return containerOrId;
  }

  // ============================================================
  // Section 2: Colors / Palette
  // ============================================================

  // Highcharts v4.1.1 default palette
  var DEFAULT_PALETTE = [
    '#7cb5ec', '#434348', '#90ed7d', '#f7a35c', '#8085e9',
    '#f15c80', '#e4d354', '#2b908f', '#f45b5b', '#91e8e1'
  ];

  function resolvePalette(hcConfig) {
    return hcConfig.colors || DEFAULT_PALETTE;
  }

  // ============================================================
  // Section 3: Title & Subtitle
  // ============================================================

  function convertTitle(hcConfig) {
    var hcTitle = hcConfig.title || {};
    var hcSubtitle = hcConfig.subtitle || {};
    var result = {};

    if (!hcTitle.text && !hcSubtitle.text) {
      return { title: { show: false } };
    }

    if (hcTitle.text) result.text = hcTitle.text;
    if (hcSubtitle.text) result.subtext = hcSubtitle.text;

    // Highcharts defaults: title centered, 15px from top
    result.left = hcTitle.align || 'center';
    result.top = 10;

    if (hcSubtitle.align) {
      result.subtextAlign = hcSubtitle.align;
    }

    // Highcharts default title style: bold 18px, color #333
    var ts = cssToEchartsTextStyle(hcTitle.style);
    result.textStyle = deepMerge({
      fontSize: 18,
      fontWeight: 'bold',
      color: '#333333',
      fontFamily: '"Lucida Grande", "Lucida Sans Unicode", Verdana, Arial, Helvetica, sans-serif'
    }, ts || {});

    // Highcharts default subtitle style: normal 12px, color #666
    var sts = cssToEchartsTextStyle(hcSubtitle.style);
    result.subtextStyle = deepMerge({
      fontSize: 12,
      color: '#666666',
      fontFamily: '"Lucida Grande", "Lucida Sans Unicode", Verdana, Arial, Helvetica, sans-serif'
    }, sts || {});

    return { title: result };
  }

  // ============================================================
  // Section 4: Axis Conversion
  // ============================================================

  var AXIS_TYPE_MAP = {
    'category': 'category',
    'datetime': 'time',
    'logarithmic': 'log',
    'linear': 'value'
  };

  function convertSingleAxis(hcAxis, role) {
    if (!hcAxis) return {};
    var ec = {};

    // Type
    if (hcAxis.categories) {
      ec.type = 'category';
      ec.data = hcAxis.categories;
    } else if (hcAxis.type) {
      ec.type = AXIS_TYPE_MAP[hcAxis.type] || 'value';
    } else {
      ec.type = 'value';
    }

    // Title — Highcharts rotates yAxis title vertically
    if (get(hcAxis, 'title.text')) {
      ec.name = hcAxis.title.text;
      ec.nameLocation = 'middle';
      ec.nameGap = 40;
      var nameStyle = cssToEchartsTextStyle(get(hcAxis, 'title.style'));
      ec.nameTextStyle = deepMerge({
        fontSize: 12,
        color: '#666666',
        fontFamily: '"Lucida Grande", "Lucida Sans Unicode", Verdana, Arial, Helvetica, sans-serif'
      }, nameStyle || {});
    }

    // Highcharts default axis label style
    var labels = hcAxis.labels || {};
    var axisLabel = {};
    var labelStyle = cssToEchartsTextStyle(labels.style);
    axisLabel.fontSize = 11;
    axisLabel.color = '#666666';
    axisLabel.fontFamily = '"Lucida Grande", "Lucida Sans Unicode", Verdana, Arial, Helvetica, sans-serif';
    if (labelStyle) {
      if (labelStyle.fontSize) axisLabel.fontSize = labelStyle.fontSize;
      if (labelStyle.color) axisLabel.color = labelStyle.color;
      if (labelStyle.fontFamily) axisLabel.fontFamily = labelStyle.fontFamily;
    }
    if (labels.rotation != null) axisLabel.rotate = labels.rotation;
    if (isFunction(labels.formatter)) {
      // Wrap HC formatter: HC passes {value} as this.value
      var hcFmt = labels.formatter;
      axisLabel.formatter = function (value) {
        return hcFmt.call({ value: value });
      };
    } else if (isString(labels.format)) {
      // Basic template conversion: {value} → {value}
      axisLabel.formatter = labels.format.replace(/\{value\}/g, '{value}');
    }
    if (labels.enabled === false) axisLabel.show = false;
    if (Object.keys(axisLabel).length) ec.axisLabel = axisLabel;

    // Min / Max
    if (hcAxis.min != null) ec.min = hcAxis.min;
    if (hcAxis.max != null) ec.max = hcAxis.max;

    // Tick interval
    if (hcAxis.tickInterval != null && ec.type === 'value') {
      ec.interval = hcAxis.tickInterval;
    }

    // Grid lines
    if (hcAxis.gridLineWidth != null) {
      ec.splitLine = {
        show: hcAxis.gridLineWidth > 0,
        lineStyle: { width: hcAxis.gridLineWidth }
      };
      if (hcAxis.gridLineColor) {
        ec.splitLine.lineStyle.color = hcAxis.gridLineColor;
      }
    }

    // Opposite
    if (hcAxis.opposite) {
      ec.position = 'right'; // overridden to 'top' for xAxis if needed
      // Adjust nameGap for right-side axis so the title doesn't get clipped
      if (ec.name) {
        ec.nameGap = 50;
      }
    }

    // Highcharts defaults: yAxis has gridlines, xAxis doesn't.
    // Secondary (opposite) yAxis does NOT show gridlines by default.
    if (hcAxis.gridLineWidth == null) {
      if (role === 'y' && !hcAxis.opposite) {
        ec.splitLine = { show: true, lineStyle: { color: '#e6e6e6', width: 1 } };
      } else {
        ec.splitLine = { show: false };
      }
    }

    // Axis line — Highcharts shows a thin line on both axes
    ec.axisLine = { lineStyle: { color: '#ccd6eb' } };

    // Tick marks
    ec.axisTick = { lineStyle: { color: '#ccd6eb' } };

    return ec;
  }

  function convertAxes(hcConfig, isBarChart) {
    var result = {};

    // Support single or array axes
    var hcXAxes = isArray(hcConfig.xAxis) ? hcConfig.xAxis : (hcConfig.xAxis ? [hcConfig.xAxis] : [{}]);
    var hcYAxes = isArray(hcConfig.yAxis) ? hcConfig.yAxis : (hcConfig.yAxis ? [hcConfig.yAxis] : [{}]);

    var ecXAxes = hcXAxes.map(function (ax) {
      var ec = convertSingleAxis(ax, 'x');
      if (ax.opposite) ec.position = 'top';
      return ec;
    });

    var ecYAxes = hcYAxes.map(function (ax) {
      return convertSingleAxis(ax, 'y');
    });

    if (isBarChart) {
      // Swap axes for horizontal bar charts
      result.xAxis = ecYAxes;
      result.yAxis = ecXAxes;
      // ECharts category yAxis goes bottom-to-top by default; invert to match Highcharts top-to-bottom
      result.yAxis.forEach(function (ax) {
        if (ax.position === 'top') ax.position = 'left';
        ax.inverse = true;
      });
      result.xAxis.forEach(function (ax) {
        if (ax.position === 'right') ax.position = 'top';
      });
    } else {
      result.xAxis = ecXAxes;
      result.yAxis = ecYAxes;
    }

    // Flatten single-element arrays
    if (result.xAxis.length === 1) result.xAxis = result.xAxis[0];
    if (result.yAxis.length === 1) result.yAxis = result.yAxis[0];

    return result;
  }

  // ============================================================
  // Section 5: Series Conversion
  // ============================================================

  var DASH_STYLE_MAP = {
    'Solid': 'solid',
    'Dash': 'dashed',
    'Dot': 'dotted',
    'ShortDash': 'dashed',
    'ShortDot': 'dotted',
    'LongDash': [8, 4],
    'DashDot': [8, 4, 2, 4],
    'ShortDashDot': [4, 2, 1, 2],
    'LongDashDot': [12, 4, 2, 4],
    'ShortDashDotDot': [4, 2, 1, 2, 1, 2],
    'LongDashDotDot': [12, 4, 2, 4, 2, 4]
  };

  var MARKER_SYMBOL_MAP = {
    'circle': 'circle',
    'square': 'rect',
    'diamond': 'diamond',
    'triangle': 'triangle',
    'triangle-down': 'arrow'
  };

  function resolvePlotOptions(hcConfig, series) {
    var globalOpts = get(hcConfig, 'plotOptions.series', {});
    var seriesType = series.type || get(hcConfig, 'chart.type', 'line');
    var typeOpts = get(hcConfig, 'plotOptions.' + seriesType, {});
    return deepMerge({}, globalOpts, typeOpts, series);
  }

  function convertPieData(data) {
    if (!isArray(data)) return [];
    return data.map(function (d) {
      if (isObject(d)) {
        return { name: d.name || '', value: d.y != null ? d.y : d.value };
      }
      if (isArray(d)) {
        return { name: d[0], value: d[1] };
      }
      return { value: d };
    });
  }

  function convertCartesianData(data) {
    if (!isArray(data)) return [];
    return data.map(function (d) {
      if (isObject(d) && !isArray(d)) {
        if (d.x != null && d.y != null) {
          return [d.x, d.y];
        }
        if (d.y != null) return d.y;
        return d;
      }
      return d; // number or [x,y] array, pass through
    });
  }

  function convertBubbleData(data) {
    if (!isArray(data)) return [];
    return data.map(function (d) {
      if (isObject(d) && !isArray(d)) {
        return [d.x, d.y, d.z];
      }
      if (isArray(d)) return d;
      return d;
    });
  }

  function computePercentStackData(allSeries) {
    // Group by stack, compute totals per index, normalize
    var stackGroups = {};
    allSeries.forEach(function (s) {
      if (s._stack) {
        if (!stackGroups[s._stack]) stackGroups[s._stack] = [];
        stackGroups[s._stack].push(s);
      }
    });

    Object.keys(stackGroups).forEach(function (stackName) {
      var group = stackGroups[stackName];
      if (!group.length) return;

      var maxLen = 0;
      group.forEach(function (s) {
        if (s.data && s.data.length > maxLen) maxLen = s.data.length;
      });

      for (var i = 0; i < maxLen; i++) {
        var total = 0;
        group.forEach(function (s) {
          var val = s.data && s.data[i];
          if (isNumber(val)) total += val;
          else if (isArray(val) && isNumber(val[1])) total += val[1];
        });
        if (total === 0) continue;
        group.forEach(function (s) {
          if (!s.data || s.data[i] == null) return;
          if (isNumber(s.data[i])) {
            s.data[i] = (s.data[i] / total) * 100;
          } else if (isArray(s.data[i]) && isNumber(s.data[i][1])) {
            s.data[i][1] = (s.data[i][1] / total) * 100;
          }
        });
      }
    });
  }

  function convertAllSeries(hcConfig, isBarChart) {
    var hcSeries = hcConfig.series || [];
    var globalType = get(hcConfig, 'chart.type', 'line');
    var isPercentStack = false;
    var ecSeries = [];

    hcSeries.forEach(function (rawSeries, idx) {
      var resolved = resolvePlotOptions(hcConfig, rawSeries);
      var hcType = resolved.type || globalType;
      var ec = {};

      ec.name = resolved.name || ('Series ' + (idx + 1));

      // -- Determine ECharts type and extras --
      switch (hcType) {
        case 'line':
          ec.type = 'line';
          break;
        case 'area':
          ec.type = 'line';
          ec.areaStyle = {};
          break;
        case 'spline':
          ec.type = 'line';
          ec.smooth = true;
          break;
        case 'areaspline':
          ec.type = 'line';
          ec.smooth = true;
          ec.areaStyle = {};
          break;
        case 'column':
          ec.type = 'bar';
          break;
        case 'bar':
          ec.type = 'bar';
          break;
        case 'pie':
          ec.type = 'pie';
          break;
        case 'scatter':
          ec.type = 'scatter';
          break;
        case 'bubble':
          ec.type = 'scatter';
          break;
        default:
          ec.type = 'line';
      }

      // -- Convert data --
      if (hcType === 'pie') {
        ec.data = convertPieData(resolved.data);
        // Donut: innerSize
        var innerSize = resolved.innerSize || resolved.innerRadius;
        var outerSize = resolved.size || '75%';
        if (innerSize) {
          var inner = isString(innerSize) ? innerSize : innerSize + '%';
          var outer = isString(outerSize) ? outerSize : outerSize + '%';
          ec.radius = [inner, outer];
        } else {
          ec.radius = isString(outerSize) ? outerSize : outerSize + '%';
        }
        // Center
        if (resolved.center) ec.center = resolved.center;
        // Start angle
        if (resolved.startAngle != null) {
          ec.startAngle = 90 - resolved.startAngle;
        }
      } else if (hcType === 'bubble') {
        ec.data = convertBubbleData(resolved.data);
        ec.symbolSize = function (val) {
          var z = isArray(val) ? val[2] : 0;
          return Math.max(Math.sqrt(Math.abs(z)) * 4, 4);
        };
      } else {
        ec.data = convertCartesianData(resolved.data);
      }

      // -- Color --
      if (resolved.color) {
        ec.itemStyle = ec.itemStyle || {};
        ec.itemStyle.color = resolved.color;
      }

      // -- Line style --
      if (resolved.lineWidth != null) {
        ec.lineStyle = ec.lineStyle || {};
        ec.lineStyle.width = resolved.lineWidth;
      }
      if (resolved.dashStyle) {
        ec.lineStyle = ec.lineStyle || {};
        ec.lineStyle.type = DASH_STYLE_MAP[resolved.dashStyle] || 'solid';
      }

      // -- Markers --
      var marker = resolved.marker || {};
      if (marker.enabled === false) {
        ec.showSymbol = false;
      } else if (marker.enabled === true) {
        ec.showSymbol = true;
      }
      if (marker.radius != null) {
        ec.symbolSize = marker.radius * 2;
      }
      if (marker.symbol) {
        ec.symbol = MARKER_SYMBOL_MAP[marker.symbol] || marker.symbol;
      }

      // -- Data labels --
      var dl = resolved.dataLabels || {};
      if (dl.enabled) {
        ec.label = { show: true };
        if (dl.format) {
          ec.label.formatter = convertLabelFormat(dl.format);
        }
        var dlStyle = cssToEchartsTextStyle(dl.style);
        if (dlStyle) {
          Object.assign(ec.label, dlStyle);
        }
      }

      // -- Stacking --
      if (resolved.stacking) {
        ec.stack = resolved.stack || 'default';
        ec._stack = ec.stack; // internal marker for percent calc
        if (resolved.stacking === 'percent') {
          isPercentStack = true;
        }
      }

      // -- yAxis index --
      if (resolved.yAxis != null && hcType !== 'pie') {
        if (isBarChart) {
          ec.xAxisIndex = resolved.yAxis;
        } else {
          ec.yAxisIndex = resolved.yAxis;
        }
      }

      // -- zIndex --
      if (resolved.zIndex != null) {
        ec.z = resolved.zIndex;
      }

      ecSeries.push(ec);
    });

    // Handle percent stacking
    if (isPercentStack) {
      computePercentStackData(ecSeries);
    }

    // Clean internal markers
    ecSeries.forEach(function (s) {
      delete s._stack;
    });

    // Fix stacked series visual order.
    // Highcharts v4 stacks in reverse: last series at bottom, first on top.
    // ECharts stacks in natural order: first series at bottom, last on top.
    // To match Highcharts, reverse the order of stacked series while
    // preserving the order of non-stacked series.
    var hasStack = ecSeries.some(function (s) { return s.stack; });
    if (hasStack) {
      var stacked = [];
      var nonStacked = [];
      ecSeries.forEach(function (s) {
        if (s.stack) stacked.push(s);
        else nonStacked.push(s);
      });
      stacked.reverse();
      ecSeries = stacked.concat(nonStacked);
    }

    return ecSeries;
  }

  function convertLabelFormat(format) {
    // Convert HC label format tokens to ECharts formatter string
    // {y} or {point.y} → {c}, {point.name} → {b}, {series.name} → {a}
    return format
      .replace(/\{point\.y\}/g, '{c}')
      .replace(/\{y\}/g, '{c}')
      .replace(/\{point\.name\}/g, '{b}')
      .replace(/\{series\.name\}/g, '{a}')
      .replace(/\{point\.x\}/g, '{b}');
  }

  // ============================================================
  // Section 6: Tooltip Conversion
  // ============================================================

  function adaptTooltipFormatter(hcFormatter) {
    return function (params) {
      var p = isArray(params) ? params[0] : params;
      var ctx = {
        x: p.name || (p.value && p.value[0]),
        y: (p.value && p.value[1]) != null ? p.value[1] : p.value,
        series: { name: p.seriesName },
        point: { name: p.name },
        percentage: p.percent,
        color: p.color,
        key: p.name || (p.value && p.value[0])
      };
      if (isArray(params)) {
        ctx.points = params.map(function (pp) {
          return {
            x: pp.name || (pp.value && pp.value[0]),
            y: (pp.value && pp.value[1]) != null ? pp.value[1] : pp.value,
            series: { name: pp.seriesName },
            point: { name: pp.name },
            color: pp.color,
            percentage: pp.percent,
            key: pp.name || (pp.value && pp.value[0])
          };
        });
      }
      return hcFormatter.call(ctx);
    };
  }

  function convertTooltipTemplate(headerFormat, pointFormat) {
    // Build a formatter function from HC header/point format templates
    return function (params) {
      var arr = isArray(params) ? params : [params];
      var html = '';

      if (headerFormat) {
        var p = arr[0];
        html += headerFormat
          .replace(/\{point\.key\}/g, p.name || '')
          .replace(/\{series\.name\}/g, p.seriesName || '');
      }

      arr.forEach(function (p) {
        var val = (p.value && p.value[1]) != null ? p.value[1] : p.value;
        var pf = (pointFormat || '')
          .replace(/\{series\.name\}/g, p.seriesName || '')
          .replace(/\{series\.color\}/g, p.color || '')
          .replace(/\{point\.y\}/g, val != null ? val : '')
          .replace(/\{point\.x\}/g, p.name || '')
          .replace(/\{point\.name\}/g, p.name || '')
          .replace(/\{point\.percentage\}/g, p.percent != null ? p.percent : '')
          .replace(/\{y\}/g, val != null ? val : '');
        html += pf;
      });

      return html;
    };
  }

  function convertTooltip(hcConfig) {
    var hcTip = hcConfig.tooltip || {};
    var ec = {};

    if (hcTip.enabled === false) {
      return { tooltip: { show: false } };
    }

    if (hcTip.shared) {
      ec.trigger = 'axis';
    } else {
      ec.trigger = 'item';
    }

    // Crosshairs → axisPointer
    if (hcTip.crosshairs) {
      ec.axisPointer = {};
      if (hcTip.crosshairs === true || (isArray(hcTip.crosshairs) && hcTip.crosshairs.length === 1)) {
        ec.axisPointer.type = 'line';
      } else if (isArray(hcTip.crosshairs) && hcTip.crosshairs.length >= 2 &&
                 hcTip.crosshairs[0] && hcTip.crosshairs[1]) {
        ec.axisPointer.type = 'cross';
      }
    }

    // Styling
    if (hcTip.backgroundColor) ec.backgroundColor = hcTip.backgroundColor;
    if (hcTip.borderColor) ec.borderColor = hcTip.borderColor;
    if (hcTip.borderWidth != null) ec.borderWidth = hcTip.borderWidth;
    var tipStyle = cssToEchartsTextStyle(hcTip.style);
    if (tipStyle) ec.textStyle = tipStyle;

    // Formatter
    if (isFunction(hcTip.formatter)) {
      ec.formatter = adaptTooltipFormatter(hcTip.formatter);
    } else if (hcTip.pointFormat || hcTip.headerFormat) {
      ec.formatter = convertTooltipTemplate(
        hcTip.headerFormat != null ? hcTip.headerFormat : '<span>{point.key}</span><br/>',
        hcTip.pointFormat || '<span style="color:{series.color}">\u25CF</span> {series.name}: <b>{point.y}</b><br/>'
      );
    }

    return { tooltip: ec };
  }

  // ============================================================
  // Section 7: Legend Conversion
  // ============================================================

  function convertLegend(hcConfig) {
    var hcLeg = hcConfig.legend || {};
    var ec = {};

    if (hcLeg.enabled === false) {
      return { legend: { show: false } };
    }

    // Layout — Highcharts default: horizontal
    if (hcLeg.layout === 'vertical') {
      ec.orient = 'vertical';
    } else {
      ec.orient = 'horizontal';
    }

    // Highcharts default: align center, verticalAlign bottom
    ec.left = hcLeg.align || 'center';
    ec.top = hcLeg.verticalAlign || 'bottom';

    // Border — Highcharts default: 0 borderWidth
    if (hcLeg.borderWidth != null) ec.borderWidth = hcLeg.borderWidth;
    if (hcLeg.borderColor) ec.borderColor = hcLeg.borderColor;

    // Highcharts default legend item style
    var itemStyle = cssToEchartsTextStyle(hcLeg.itemStyle);
    ec.textStyle = deepMerge({
      fontSize: 12,
      color: '#333333',
      fontFamily: '"Lucida Grande", "Lucida Sans Unicode", Verdana, Arial, Helvetica, sans-serif'
    }, itemStyle || {});

    // Use line icon style similar to Highcharts (line with small marker)
    ec.icon = 'roundRect';
    ec.itemWidth = 14;
    ec.itemHeight = 10;

    return { legend: ec };
  }

  // ============================================================
  // Section 8: Grid / Layout
  // ============================================================

  function convertGrid(hcConfig) {
    var chart = hcConfig.chart || {};
    var hcLeg = hcConfig.legend || {};
    var hasSubtitle = get(hcConfig, 'subtitle.text');
    var grid = { containLabel: true };

    // Highcharts default spacing: top 10, right 10, bottom 15, left 10
    // But we need room for title at top and legend at bottom
    var topBase = hasSubtitle ? 70 : 55;
    grid.top = chart.spacingTop != null ? chart.spacingTop : (chart.marginTop != null ? chart.marginTop : topBase);
    // Check if there's an opposite (right-side) yAxis — need more right margin for its title
    var hcYAxes = isArray(hcConfig.yAxis) ? hcConfig.yAxis : (hcConfig.yAxis ? [hcConfig.yAxis] : []);
    var hasOppositeAxis = hcYAxes.some(function (ax) { return ax.opposite; });
    var rightBase = hasOppositeAxis ? 60 : 20;
    grid.right = chart.spacingRight != null ? chart.spacingRight : (chart.marginRight != null ? chart.marginRight : rightBase);

    // If legend is at bottom (default), leave room for it
    var legendAtBottom = !hcLeg.verticalAlign || hcLeg.verticalAlign === 'bottom';
    var bottomBase = (hcLeg.enabled !== false && legendAtBottom) ? 50 : 25;
    grid.bottom = chart.spacingBottom != null ? chart.spacingBottom : (chart.marginBottom != null ? chart.marginBottom : bottomBase);
    grid.left = chart.spacingLeft != null ? chart.spacingLeft : (chart.marginLeft != null ? chart.marginLeft : 20);

    return { grid: grid };
  }

  // ============================================================
  // Section 9: Plot Lines & Plot Bands (partial support)
  // ============================================================

  function convertPlotLines(hcAxis, axisType) {
    var markLines = [];
    if (hcAxis.plotLines) {
      hcAxis.plotLines.forEach(function (pl) {
        var line = {};
        if (axisType === 'x') {
          line.xAxis = pl.value;
        } else {
          line.yAxis = pl.value;
        }
        var item = { data: [[line]] };
        if (pl.color) {
          item.lineStyle = { color: pl.color };
        }
        if (pl.width) {
          item.lineStyle = item.lineStyle || {};
          item.lineStyle.width = pl.width;
        }
        if (pl.dashStyle) {
          item.lineStyle = item.lineStyle || {};
          item.lineStyle.type = DASH_STYLE_MAP[pl.dashStyle] || 'solid';
        }
        if (pl.label && pl.label.text) {
          item.label = { formatter: pl.label.text, show: true };
        }
        markLines.push(item);
      });
    }
    return markLines;
  }

  // ============================================================
  // Section 10: Top-Level Orchestrator
  // ============================================================

  function convert(hcConfig) {
    if (!hcConfig) return {};

    var globalType = get(hcConfig, 'chart.type', 'line');
    var series = hcConfig.series || [];

    // Detect bar chart (axes need swapping)
    var isBarChart = globalType === 'bar' ||
      series.some(function (s) { return s.type === 'bar'; });

    // Detect pie-only chart (no cartesian axes needed)
    var isPieOnly = (series.length > 0) && series.every(function (s) {
      var t = s.type || globalType;
      return t === 'pie';
    });

    var palette = resolvePalette(hcConfig);
    var option = {};

    // Title
    var titleResult = convertTitle(hcConfig);
    if (titleResult.title) option.title = titleResult.title;

    // Legend
    var legendResult = convertLegend(hcConfig);
    if (legendResult.legend) option.legend = legendResult.legend;

    // Tooltip
    var tooltipResult = convertTooltip(hcConfig);
    if (tooltipResult.tooltip) option.tooltip = tooltipResult.tooltip;

    // Axes (only for cartesian charts)
    if (!isPieOnly) {
      var axesResult = convertAxes(hcConfig, isBarChart);
      option.xAxis = axesResult.xAxis;
      option.yAxis = axesResult.yAxis;

      // Highcharts auto-scales value axes to data range (doesn't force 0).
      // For scatter/bubble charts, set scale:true so ECharts does the same.
      var hasScatterOrBubble = series.some(function (s) {
        var t = s.type || globalType;
        return t === 'scatter' || t === 'bubble';
      });
      if (hasScatterOrBubble) {
        var setScale = function (ax) {
          if (ax && ax.type !== 'category' && ax.type !== 'time') {
            ax.scale = true;
          }
        };
        if (isArray(option.xAxis)) { option.xAxis.forEach(setScale); } else { setScale(option.xAxis); }
        if (isArray(option.yAxis)) { option.yAxis.forEach(setScale); } else { setScale(option.yAxis); }
      }

      var gridResult = convertGrid(hcConfig);
      option.grid = gridResult.grid;
    }

    // Series
    option.series = convertAllSeries(hcConfig, isBarChart);

    // Colors
    option.color = palette;

    // Background — Highcharts default is white
    option.backgroundColor = get(hcConfig, 'chart.backgroundColor', '#FFFFFF');

    // Global text style to match Highcharts font family
    option.textStyle = {
      fontFamily: '"Lucida Grande", "Lucida Sans Unicode", Verdana, Arial, Helvetica, sans-serif'
    };

    // Animation
    var anim = get(hcConfig, 'plotOptions.series.animation');
    if (anim === false) {
      option.animation = false;
    }

    return option;
  }

  // ============================================================
  // Section 11: Render Helper
  // ============================================================

  function chart(containerOrId, hcConfig) {
    if (typeof echarts === 'undefined') {
      throw new Error(
        'HighchartsCompat: echarts is not loaded. ' +
        'Include echarts.min.js via <script> tag before this file.'
      );
    }

    // Support Highcharts-style config with chart.renderTo
    var containerId = containerOrId || get(hcConfig, 'chart.renderTo');
    var container = resolveContainer(containerId);
    if (!container) {
      throw new Error('HighchartsCompat: container element not found: ' + containerId);
    }

    var initOpts = {};
    var w = get(hcConfig, 'chart.width');
    var h = get(hcConfig, 'chart.height');
    if (w) initOpts.width = w;
    if (h) initOpts.height = h;

    var instance = echarts.init(container, null, Object.keys(initOpts).length ? initOpts : undefined);
    var option = convert(hcConfig);
    instance.setOption(option);

    // Auto-resize
    var resizeHandler = function () { instance.resize(); };
    window.addEventListener('resize', resizeHandler);

    // Attach destroy() mimicking Highcharts.Chart.destroy()
    var originalDispose = instance.dispose.bind(instance);
    instance.destroy = function () {
      window.removeEventListener('resize', resizeHandler);
      originalDispose();
    };

    return instance;
  }

  // ============================================================
  // Section 12: Public API
  // ============================================================

  global.HighchartsCompat = {
    convert: convert,
    chart: chart,
    version: '1.0.0'
  };

  // ============================================================
  // Section 13: Highcharts API Shim
  // Drop-in compatibility so existing code using
  //   new Highcharts.Chart({ chart: { renderTo: 'id' }, ... })
  //   Highcharts.setOptions(...)
  //   Highcharts.charts
  // works without any code changes.
  // ============================================================

  var globalOptions = {};
  var chartsRegistry = [];

  function ChartShim(config) {
    // Merge any global options set via Highcharts.setOptions()
    var merged = deepMerge({}, globalOptions, config);
    var containerId = get(merged, 'chart.renderTo');
    var instance = chart(containerId, merged);

    // Track in the charts registry (like Highcharts.charts[])
    instance.index = chartsRegistry.length;
    chartsRegistry.push(instance);

    return instance;
  }

  global.Highcharts = {
    Chart: ChartShim,
    chart: chart,
    charts: chartsRegistry,
    setOptions: function (opts) {
      globalOptions = deepMerge(globalOptions, opts);
    },
    getOptions: function () {
      return deepMerge({}, globalOptions);
    },
    dateFormat: function (format, timestamp) {
      // Basic date formatting shim
      var d = new Date(timestamp);
      return d.toLocaleDateString();
    },
    numberFormat: function (number, decimals, decPoint, thousandsSep) {
      decimals = decimals != null ? decimals : 2;
      decPoint = decPoint || '.';
      thousandsSep = thousandsSep || ',';
      var parts = number.toFixed(decimals).split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSep);
      return parts.join(decPoint);
    },
    color: function (c) { return c; },
    wrap: function () {},
    addEvent: function (el, type, fn) {
      if (el && el.addEventListener) el.addEventListener(type, fn);
    },
    removeEvent: function (el, type, fn) {
      if (el && el.removeEventListener) el.removeEventListener(type, fn);
    },
    // Version identifier so code checking Highcharts.version won't break
    version: '4.1.1-compat',
    product: 'ECharts-Compat'
  };

})(typeof window !== 'undefined' ? window : this);
