import { describe, expect, it } from 'vitest';
import { dropDeadFramebufferHandles, type FramebufferHandles } from './lost-context-handles';

describe('dropDeadFramebufferHandles', () => {
  it('forgets the framebuffer and the renderbuffers but keeps texture attachments', () => {
    const texture = { id: 'tex' };
    const wrapper: FramebufferHandles = {
      webGLFramebuffer: { id: 'fb' },
      attachments: [{ texture }, { renderbuffer: { id: 'rb' } }],
    };
    dropDeadFramebufferHandles([wrapper]);
    expect(wrapper.webGLFramebuffer).toBeNull();
    expect(wrapper.attachments[0]?.texture).toBe(texture);
    expect(wrapper.attachments[1]?.renderbuffer).toBeNull();
  });

  it('leaves the canvas-backed wrapper alone', () => {
    const fb = { id: 'fb' };
    const wrapper: FramebufferHandles = { useCanvas: true, webGLFramebuffer: fb, attachments: [] };
    dropDeadFramebufferHandles([wrapper]);
    expect(wrapper.webGLFramebuffer).toBe(fb);
  });
});
