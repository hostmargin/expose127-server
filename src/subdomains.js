'use strict';

const { v4: uuidv4 } = require('uuid');

const ADJECTIVES = [
  'fast','bold','cool','wild','dark','slim','tiny','vast','wise','warm',
  'calm','deep','firm','keen','late','mild','neat','pale','pure','rare',
  'rich','safe','soft','tall','tame','true','vain','wary','weak','zany',
];
const NOUNS = [
  'pine','wave','hawk','reef','mist','dusk','leaf','moon','star','tide',
  'arch','bank','beam','bell','bird','bone','bush','cage','cape','cave',
  'clay','clip','coal','coat','coil','cord','core','cork','corn','cove',
];

/**
 * Generate a random subdomain like "fast-wave-4821"
 */
function randomSubdomain() {
  const adj  = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num  = Math.floor(Math.random() * 9000) + 1000;
  return `${adj}-${noun}-${num}`;
}

/**
 * Generate a unique subdomain not already in the given registry Map.
 * Falls back to a UUID fragment after 50 failed attempts.
 */
function uniqueSubdomain(registry, requested) {
  if (requested) {
    const clean = requested.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 63);
    if (!registry.has(clean)) return clean;
    // Requested is taken — append random suffix
    const fallback = `${clean}-${Math.floor(Math.random() * 9000) + 1000}`;
    if (!registry.has(fallback)) return fallback;
  }

  let attempts = 0;
  let sub;
  do {
    sub = attempts < 50 ? randomSubdomain() : uuidv4().split('-')[0];
    attempts++;
  } while (registry.has(sub));

  return sub;
}

module.exports = { uniqueSubdomain };
