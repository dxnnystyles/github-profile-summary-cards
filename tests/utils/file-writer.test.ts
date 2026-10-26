import {writeSVG, OUTPUT_PATH, resolveOutputPath} from '../../src/utils/file-writer';
import {rmSync, readFileSync} from 'fs';
const targetFolder = `${OUTPUT_PATH}/test`;

afterEach(() => {
    rmSync(targetFolder, {recursive: true, force: true});
});
describe('Test output function', () => {
    it('test write svg can work', () => {
        writeSVG('test', 'write-svg', 'work');
        const content = readFileSync(`${targetFolder}/write-svg.svg`, {
            encoding: 'utf8',
            flag: 'r'
        });
        expect(content).toEqual('work');
    });
});

describe('temporary output path', () => {
    it('requires an absolute child directory of RUNNER_TEMP for Action runs', () => {
        expect(() => resolveOutputPath(undefined, '/tmp/runner', true)).toThrow(/requires SUMMARY_CARDS_OUTPUT_PATH/);
        expect(resolveOutputPath('/tmp/runner/cards', '/tmp/runner', true)).toBe('/tmp/runner/cards/');
        expect(() => resolveOutputPath('/tmp/cards', '/tmp/runner', true)).toThrow(/child directory of RUNNER_TEMP/);
        expect(() => resolveOutputPath('runner/cards', '/tmp/runner', true)).toThrow(/child directory of RUNNER_TEMP/);
    });
});
