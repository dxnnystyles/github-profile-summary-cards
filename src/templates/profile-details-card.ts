import {Card, TITLE_LINE_HEIGHT} from './card';
import * as d3 from 'd3';
import {Theme} from '../const/theme';

export function createDetailCard(
    title: string,
    userDetails: {
        index: number;
        icon: string;
        name: string;
        value: string;
    }[],
    contributionsData: {contributionCount: number; date: Date}[],
    theme: Theme,
    chartCaption: string = 'contributions in the last year',
    cardHeight = 200
) {
    const mobileReadableLayout = cardHeight === 380;
    const extraTitleLines = Math.max(0, title.split('\n').length - 1);
    const card = new Card(
        title,
        700,
        cardHeight + extraTitleLines * TITLE_LINE_HEIGHT,
        theme,
        30,
        40,
        'Public GitHub profile details showing account age, public repository count, an all-time contribution total, and monthly totals aggregated from the public daily contribution calendar for the trailing year.'
    );
    const svg = card.getSVG();

    // draw icon
    const panel = svg.append('g').attr('transform', `translate(30,30)`);
    const labelHeight = mobileReadableLayout ? 20 : 16;
    const detailColumns = [0, 215, 430];
    // Each detail item (icon + value) remains an animatable item. Position the
    // three approved values on one row above the full-width contribution chart.
    panel
        .selectAll(null)
        .data(userDetails)
        .enter()
        .append('g')
        .attr('class', 'gpsc-item')
        .style('--gpsc-i', d => String(d.index))
        .append('g')
        .attr('transform', d => {
            if (!mobileReadableLayout) {
                return `translate(0,${labelHeight * d.index * 2})`;
            }
            return `translate(${detailColumns[d.index] ?? 0},0)`;
        })
        .attr('width', labelHeight)
        .attr('height', labelHeight)
        .attr('fill', theme.icon)
        .html(d => d.icon);

    // draw text
    panel
        .selectAll(null)
        .data(userDetails)
        .enter()
        .append('text')
        .text(d => (mobileReadableLayout ? profileDetailValue(d.index, d.value) : d.value))
        .attr('x', d => (mobileReadableLayout ? detailColumns[d.index] ?? 0 : 0) + labelHeight * 1.5)
        .attr('y', d => (mobileReadableLayout ? labelHeight : labelHeight * d.index * 2 + labelHeight))
        .attr('class', 'gpsc-item')
        .style('--gpsc-i', d => String(d.index))
        .style('fill', theme.text)
        // The SVG is authored at 700px and GitHub scales it to a 366px column
        // on narrow screens. Use near-2x type here so the displayed values stay
        // comparable to ordinary 13-14px text after that scaling.
        .style('font-size', `${mobileReadableLayout ? 28 : labelHeight}px`)
        .style('font-weight', mobileReadableLayout ? 'bold' : 'normal');

    if (mobileReadableLayout) {
        const labelLines = (index: number): string[] => {
            if (index === 0) return ['All-time', 'contributions'];
            if (index === 1) return ['Public repos'];
            if (index === 2) return ['Joined GitHub'];
            return [];
        };
        const labels = panel
            .selectAll(null)
            .data(userDetails)
            .enter()
            .append('g')
            .attr('class', 'gpsc-item')
            .style('--gpsc-i', d => String(d.index));
        labels.each((d, index, nodes) => {
            d3.select(nodes[index])
                .selectAll(null)
                .data(labelLines(d.index))
                .enter()
                .append('text')
                .text(line => line)
                .attr('x', detailColumns[d.index] ?? 0)
                .attr('y', (_, lineIndex) => 50 + lineIndex * 16)
                .style('fill', theme.text)
                .style('font-size', '24px');
        });
    }

    const lineChartData = aggregateContributionsByUtcMonth(contributionsData);

    // prepare chart data
    const chartRightMargin = 32;
    const chartWidth = mobileReadableLayout
        ? card.width - 2 * card.xPadding - chartRightMargin
        : card.width - 2 * card.xPadding - chartRightMargin - 230;
    const chartHeight = mobileReadableLayout
        ? 150
        : card.height - extraTitleLines * TITLE_LINE_HEIGHT - 2 * card.yPadding - 10;
    const x = d3.scaleUtc().range([0, chartWidth]);

    x.domain(
        <[Date, Date]>d3.extent(lineChartData, function (d) {
            return d.date;
        })
    );

    // eslint-disable-next-line prefer-spread
    const yMax = Math.max.apply(
        Math,
        lineChartData.map(function (o) {
            return o.contributionCount;
        })
    );

    const y = d3.scaleLinear().range([chartHeight, 0]);
    y.domain([0, yMax]);
    y.nice();

    const valueline = d3
        .area<{contributionCount: number; date: Date}>()
        .x(function (d) {
            return x(d.date);
        })
        .y0(y(0))
        .y1(function (d) {
            return y(d.contributionCount);
        })
        .curve(d3.curveMonotoneX);

    const chartPanel = svg
        .append('g')
        .attr('color', theme.chart)
        .attr(
            'transform',
            mobileReadableLayout
                ? `translate(${card.xPadding},145)`
                : `translate(${card.width - chartWidth - card.xPadding + 5},10)`
        );

    // Inert reveal clip: a full-size rect clipping the area chart. By default it
    // covers the whole plotting region (no visual change); a "reveal"/"sequence"
    // animation scales it in from the left so the area draws on along the x-axis.
    const REVEAL_CLIP_ID = 'gpsc-reveal-clip';
    const revealWidth = chartWidth + chartRightMargin;
    chartPanel
        .append('clipPath')
        .attr('id', REVEAL_CLIP_ID)
        .append('rect')
        .attr('class', 'gpsc-reveal')
        .attr('x', -chartRightMargin)
        .attr('y', 0)
        .attr('width', revealWidth)
        .attr('height', chartHeight)
        // Full width available to the wipe animation, which slides the clip in from
        // the left by this many px (a reliably left-to-right reveal; no
        // transform-origin). The index places the wipe after the detail rows.
        .style('--gpsc-w', `${revealWidth}px`)
        .style('--gpsc-i', String(userDetails.length));

    // draw chart line (inside a transform-less, clipped wrapper so the reveal clip
    // lines up with the plotting area). The wrapper is an animatable item (revealed
    // after the detail rows) so it fades in for the non-drawing presets.
    chartPanel
        .append('g')
        .attr('clip-path', `url(#${REVEAL_CLIP_ID})`)
        // `.gpsc-chart` (not `.gpsc-item`): the non-drawing presets fade it in with
        // the content, while the drawing presets (draw/load/sequence) leave its
        // opacity alone and reveal it purely via the `.gpsc-reveal` clip wipe — so
        // the two never fight and the line always draws from the left.
        .attr('class', 'gpsc-chart')
        .style('--gpsc-i', String(userDetails.length))
        .append('path')
        .data([lineChartData])
        .attr('transform', mobileReadableLayout ? 'translate(0,0)' : `translate(${-chartRightMargin},0)`)
        .attr('stroke', theme.chart)
        .attr('fill', theme.chart)
        .attr('opacity', 1)
        .attr('d', valueline);

    // Add the X Axis
    const xAxis = d3
        .axisBottom<Date>(x)
        .tickPadding(mobileReadableLayout ? 10 : 3)
        .tickFormat(d3.utcFormat('%y/%m'))
        .tickValues(
            lineChartData
                .filter((_, i) => i % (mobileReadableLayout ? 6 : 4) === 0)
                .map(d => {
                    return d.date;
                })
        );

    const xAxisGroup = chartPanel
        .append('g')
        .attr('color', theme.text)
        .attr(
            'transform',
            mobileReadableLayout ? `translate(0,${chartHeight})` : `translate(${-chartRightMargin},${chartHeight})`
        )
        .call(xAxis)
        .attr('font-size', mobileReadableLayout ? '28px' : '12px');
    if (mobileReadableLayout) {
        xAxisGroup
            .selectAll<SVGTextElement, Date>('.tick text')
            .filter((_, index) => index === 0)
            .attr('text-anchor', 'start')
            .attr('dx', '6px');
        xAxisGroup
            .selectAll<SVGTextElement, Date>('.tick text')
            .filter((_, index, nodes) => nodes.length > 1 && index === nodes.length - 1)
            .attr('text-anchor', 'end')
            .attr('dx', '-6px');
    }

    // Add the Y Axis
    chartPanel
        .append('g')
        .attr('color', theme.text)
        .attr(
            'transform',
            mobileReadableLayout ? `translate(${chartWidth},0)` : `translate(${chartWidth - chartRightMargin},0)`
        )
        .call(d3.axisRight(y).ticks(5))
        .attr('font-size', mobileReadableLayout ? '28px' : '12px');

    // Caption goes above the chart for short titles, below the chart for tall/long titles
    // (multi-line titles push the chart down and the caption would otherwise overlap them).
    const titleIsTall = title.includes('\n') || title.length > 30;
    chartPanel
        .append('g')
        .append('text')
        .text(chartCaption)
        .attr('y', mobileReadableLayout ? -12 : titleIsTall ? 140 : -15)
        .attr('x', mobileReadableLayout ? chartWidth / 2 : 230)
        .attr('text-anchor', mobileReadableLayout ? 'middle' : 'start')
        .style('fill', theme.text)
        .style('font-size', mobileReadableLayout ? '24px' : '10px');

    return card.toString();
}

function profileDetailValue(index: number, value: string): string {
    if (index === 0) return value.replace(/ Contributions on GitHub$/, '');
    if (index === 1) return value.replace(/ Public Repos$/, '');
    if (index === 2) return value.replace(/^Joined GitHub /, '');
    return value;
}

export function aggregateContributionsByUtcMonth(
    contributionsData: {contributionCount: number; date: Date}[]
): {contributionCount: number; date: Date}[] {
    const lineChartData: {contributionCount: number; date: Date}[] = [];
    for (const data of contributionsData) {
        const monthDate = new Date(Date.UTC(data.date.getUTCFullYear(), data.date.getUTCMonth(), 1));
        const lastIndex = lineChartData.length - 1;
        if (lineChartData.length === 0 || lineChartData[lastIndex].date.getTime() !== monthDate.getTime()) {
            lineChartData.push({contributionCount: data.contributionCount, date: monthDate});
        } else {
            lineChartData[lastIndex].contributionCount += data.contributionCount;
        }
    }
    return lineChartData;
}
