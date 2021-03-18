import { render } from './helper';
import { MyApp } from '../src/my-app';

describe('my-app', () => {
  it('should render message', async () => {
    const node = (await render('<my-app></my-app>', MyApp)).firstElementChild;
    const text =  node.textContent;
    expect(text.trim()).toBe('Hello World!');
  });
});
