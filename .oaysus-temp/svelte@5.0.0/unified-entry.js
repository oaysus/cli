
// Main svelte exports
export * from 'svelte';
import * as _svelte from 'svelte';
export default _svelte;

// Re-export internal/client as named exports
import * as _internalClient from 'svelte/internal/client';
export const internal_client = _internalClient;

// Re-export internal/disclose-version
import * as _discloseVersion from 'svelte/internal/disclose-version';
export const internal_disclose_version = _discloseVersion;

// Re-export store
import * as _store from 'svelte/store';
export const store = _store;

// Re-export transition
import * as _transition from 'svelte/transition';
export const transition = _transition;

// Re-export motion
import * as _motion from 'svelte/motion';
export const motion = _motion;

// Re-export animate
import * as _animate from 'svelte/animate';
export const animate = _animate;

// Re-export easing
import * as _easing from 'svelte/easing';
export const easing = _easing;
