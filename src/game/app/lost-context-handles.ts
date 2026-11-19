/** The parts of a Phaser framebuffer wrapper the restore step looks at. */
export interface FramebufferHandles {
  useCanvas?: boolean;
  webGLFramebuffer: unknown;
  attachments: { texture?: unknown; renderbuffer?: unknown }[];
}

/**
 * Forgets the GL handles of framebuffers that died with a lost context. On restore Phaser makes
 * the framebuffer again but first calls deleteFramebuffer / deleteRenderbuffer on the old handles,
 * and those belong to the dead context, so the browser prints "INVALID_OPERATION: delete: object
 * does not belong to this context" once per handle (24 per loss). The dead objects are freed
 * with their context; without the handles Phaser has nothing to delete and just creates new ones.
 */
export function dropDeadFramebufferHandles(wrappers: readonly FramebufferHandles[]): void {
  for (const wrapper of wrappers) {
    if (wrapper.useCanvas) continue;
    wrapper.webGLFramebuffer = null;
    for (const attachment of wrapper.attachments) {
      if (!attachment.texture) attachment.renderbuffer = null;
    }
  }
}
