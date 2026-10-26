import {createProductiveCard} from '../../src/templates/productive-time-card';
import {ThemeMap} from '../../src/const/theme';

const chartData = new Array(24).fill(0);
const theme = ThemeMap.get('default')!;

describe('productive time card template', () => {
    it('uses a concise title and keeps the UTC offset visible', () => {
        const svg = createProductiveCard(chartData, theme, 8);
        expect(svg).toContain('Commits by Hour');
        expect(svg).toContain('Hour · UTC+8.00');
        expect(svg).toContain('The 24 bars represent hours of the day.');
        expect(svg).toContain('y="126"');
    });

    it('shows the IANA time-zone label without a clipped title', () => {
        const svg = createProductiveCard(chartData, theme, 8, 'Europe/Zurich');
        expect(svg).toContain('Commits by Hour');
        expect(svg).toContain('Hour · Europe/Zurich');
        expect(svg).not.toContain('UTC +8.00');
    });
});
