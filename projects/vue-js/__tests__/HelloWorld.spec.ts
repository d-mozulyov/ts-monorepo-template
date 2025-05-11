import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HelloWorld from '../src/components/HelloWorld.vue';

describe('HelloWorld Component', () => {
  it('renders message correctly', () => {
    const message = 'Hello Vitest';
    const wrapper = mount(HelloWorld, {
      props: {
        msg: message,
      },
    });
    expect(wrapper.find('h1').text()).toBe(message);
  });
});