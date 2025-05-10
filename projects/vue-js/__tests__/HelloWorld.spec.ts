import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HelloWorld from '../src/components/HelloWorld.vue';

/**
 * Test suite for HelloWorld component
 * Verifies correct rendering and basic functionality
 */
describe('HelloWorld Component', () => {
  // Test for correct display of the passed message
  it('renders message correctly', () => {
    const message = 'Hello Vitest';
    const wrapper = mount(HelloWorld, {
      props: {
        msg: message,
      },
    });

    // Check that the message is displayed correctly
    expect(wrapper.find('h1').text()).toBe(message);
  });

  // Test for counter increment when clicking the button
  it('increments counter when button is clicked', async () => {
    const wrapper = mount(HelloWorld, {
      props: {
        msg: 'Test Counter',
      },
    });

    // Get the button and check the initial counter value
    const button = wrapper.find('button');
    expect(button.text()).toContain('count is 0');

    // Click the button and check that the counter has increased
    await button.trigger('click');
    expect(button.text()).toContain('count is 1');

    // Click again and check that the counter has increased to 2
    await button.trigger('click');
    expect(button.text()).toContain('count is 2');
  });
});
