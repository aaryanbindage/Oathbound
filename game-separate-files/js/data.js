'use strict';
// Game content tables. The world and the ten Orders come from Brandon Sanderson's books;
// every character, spren name, oath wording and plot beat in this file is written for this fan game.
const TYPES = { slash: { name: 'Slash', col: '#f0d890' }, pierce: { name: 'Pierce', col: '#9fe0a8' }, crush: { name: 'Crush', col: '#e89c6c' }, light: { name: 'Light', col: '#a8e4ff' } };

const SKILLS = {
  // Adhesion
  lashbind: { name: 'Full Lashing', cost: 4, target: 'foe', pow: 1.1, type: 'crush', fx: 'melee', status: { key: 'stun', turns: 1, chance: .6 }, desc: 'Bind a foe to the ground. May stun.' },
  pressure: { name: 'Pressure Bond', cost: 6, target: 'allies', status: { key: 'defUp', turns: 3 }, fx: 'aura', desc: 'Bond the air around the party. Defense up.' },
  // Gravitation
  skyward: { name: 'Basic Lashing', cost: 4, target: 'foe', pow: 1.6, type: 'crush', fx: 'lift', desc: 'Make the sky a foe\'s floor, then let it fall.' },
  reverse: { name: 'Reverse Lashing', cost: 8, target: 'foes', pow: 1, type: 'crush', fx: 'nova', status: { key: 'defDown', turns: 2 }, desc: 'Drag all foes together. Lowers defense.' },
  // Division
  unmake: { name: 'Unmaking Touch', cost: 4, target: 'foe', pow: 1.3, type: 'pierce', fx: 'melee', status: { key: 'burn', turns: 3 }, desc: 'Decay flesh and steel. Burns.' },
  ashbloom: { name: 'Ash Bloom', cost: 8, target: 'foes', pow: 1, type: 'light', fx: 'nova', status: { key: 'burn', turns: 2 }, desc: 'The ground itself burns away beneath all foes.' },
  // Abrasion
  skimstrike: { name: 'Skimming Strike', cost: 4, target: 'foe', pow: .7, hits: 3, type: 'slash', fx: 'melee', desc: 'Slide past friction. Three quick cuts.' },
  slickfield: { name: 'Frictionless Ground', cost: 6, target: 'foes', status: { key: 'blind', turns: 2 }, fx: 'nova', pow: .5, type: 'pierce', desc: 'Foes slip and lose their aim.' },
  // Progression
  regrowth: { name: 'Regrowth', cost: 4, target: 'ally', heal: 1.8, fx: 'aura', desc: 'Knit one ally\'s wounds. Revives the fallen.' },
  bloomtide: { name: 'Bloomtide', cost: 9, target: 'allies', heal: 1.1, status: { key: 'regen', turns: 3 }, fx: 'aura', desc: 'Heal the party and let the healing linger.' },
  // Illumination
  phantom: { name: 'Phantom Double', cost: 4, target: 'self', status: { key: 'decoy', turns: 2 }, fx: 'aura', desc: 'A false self takes the next blow.' },
  gloryglare: { name: 'Glorious Glare', cost: 7, target: 'foes', pow: .9, type: 'light', fx: 'nova', status: { key: 'blind', turns: 2 }, desc: 'A burst of false dawn. Foes lose their aim.' },
  // Transformation
  soulsmoke: { name: 'Soulcast: Smoke', cost: 5, target: 'foe', pow: 1.5, type: 'light', fx: 'bolt', status: { key: 'defDown', turns: 2 }, desc: 'Persuade armor to become smoke.' },
  soulstone: { name: 'Soulcast: Stone', cost: 8, target: 'foe', pow: 1.2, type: 'crush', fx: 'bolt', status: { key: 'stun', turns: 2, chance: .8 }, desc: 'Persuade a foe\'s legs to be granite.' },
  // Transportation
  stepbetween: { name: 'Step Between', cost: 4, target: 'foe', pow: 1.4, type: 'pierce', fx: 'melee', status: { key: 'atkDown', turns: 2 }, desc: 'Vanish into the Cognitive and strike from behind.' },
  elsewhere: { name: 'Elsewhere Rend', cost: 8, target: 'foes', pow: 1.05, type: 'pierce', fx: 'nova', desc: 'Pull all foes a little way out of the world.' },
  // Cohesion
  stoneshape: { name: 'Stone Shaping', cost: 4, target: 'foes', pow: .8, type: 'crush', fx: 'nova', desc: 'Stone turns soft, then becomes spears.' },
  livingwall: { name: 'Living Wall', cost: 7, target: 'allies', status: { key: 'shield', turns: 2 }, fx: 'aura', desc: 'Raise a wall that absorbs a strike for each ally.' },
  // Tension
  ironcloth: { name: 'Ironcloth', cost: 4, target: 'self', status: { key: 'defUp', turns: 3 }, fx: 'aura', heal: .5, desc: 'Stiffen your coat like steel and catch your breath.' },
  rigidlash: { name: 'Rigid Lash', cost: 6, target: 'foe', pow: 2, type: 'crush', fx: 'melee', desc: 'A cloth whip as hard as a warhammer.' },
  // Companions
  bridgewall: { name: 'Bridge Formation', cost: 4, target: 'allies', status: { key: 'defUp', turns: 2 }, fx: 'aura', desc: 'Everyone in step. Defense up.' },
  shieldbash: { name: 'Shield Bash', cost: 3, target: 'foe', pow: 1.1, type: 'crush', fx: 'melee', status: { key: 'stun', turns: 1, chance: .5 }, desc: 'Crushing blow. May stun.' },
  spearwall: { name: 'Spear Wall', cost: 5, target: 'foes', pow: .9, type: 'pierce', fx: 'nova', desc: 'A sweeping thrust across all foes.' },
  rally: { name: 'Rally Cry', cost: 6, target: 'allies', heal: .7, status: { key: 'atkUp', turns: 2 }, fx: 'aura', desc: 'Heal a little. Attack up.' },
  painrial: { name: 'Painrial', cost: 3, target: 'ally', heal: 1.5, fx: 'aura', desc: 'A garnet fabrial that draws pain out. Revives the fallen.' },
  flarelamp: { name: 'Flare Lamp', cost: 4, target: 'foes', pow: .85, type: 'light', fx: 'nova', desc: 'An overcharged spherelamp flash at all foes.' },
  snare: { name: 'Conjoined Snare', cost: 4, target: 'foe', pow: .8, type: 'pierce', fx: 'bolt', status: { key: 'atkDown', turns: 3 }, desc: 'Conjoined rubies drag a foe\'s arm off line.' },
  overcharge: { name: 'Sphere Burst', cost: 7, target: 'foe', pow: 2.2, type: 'light', fx: 'bolt', desc: 'Crack a broam and aim the Light.' }
};

const SURGES = {
  adhesion: { name: 'Adhesion', desc: 'The Surge of pressure and bonding.', a: 'lashbind', b: 'pressure' },
  gravitation: { name: 'Gravitation', desc: 'The Surge of which way is down.', a: 'skyward', b: 'reverse' },
  division: { name: 'Division', desc: 'The Surge of decay and destruction.', a: 'unmake', b: 'ashbloom' },
  abrasion: { name: 'Abrasion', desc: 'The Surge of friction and its absence.', a: 'skimstrike', b: 'slickfield' },
  progression: { name: 'Progression', desc: 'The Surge of growth and healing.', a: 'regrowth', b: 'bloomtide' },
  illumination: { name: 'Illumination', desc: 'The Surge of light and false seeming.', a: 'phantom', b: 'gloryglare' },
  transformation: { name: 'Transformation', desc: 'The Surge of Soulcasting.', a: 'soulsmoke', b: 'soulstone' },
  transportation: { name: 'Transportation', desc: 'The Surge of motion between realms.', a: 'stepbetween', b: 'elsewhere' },
  cohesion: { name: 'Cohesion', desc: 'The Surge of strong binding in stone.', a: 'stoneshape', b: 'livingwall' },
  tension: { name: 'Tension', desc: 'The Surge of soft things made rigid.', a: 'ironcloth', b: 'rigidlash' }
};

// The ring: each Order shares one Surge with the next, as in the Ars Arcanum.
const ORDERS = [
  { id: 'windrunner', name: 'Windrunners', surges: ['adhesion', 'gravitation'], sprenKind: 'honorspren', spren: 'Aeri', shape: 'person', color: '#7fc8ff', dark: '#2b5f9e', creed: 'Protect those who cannot protect themselves.',
    desc: 'Soldiers of the open sky. They fall upward, bind foes to stone, and put themselves between danger and the helpless.',
    passive: { key: 'guardian', name: 'Guardian\'s Reach', desc: 'Blocking an attack also grants 2 Resonance and +1 Stormlight.' }, stat: { atk: 1.05, def: 1, hp: 1, sl: 1 },
    ult: { name: 'Falling Sky', desc: 'Hurl all foes into the clouds and call them home.', pow: 3.2, type: 'crush', status: { key: 'stun', turns: 1, chance: .5 } },
    traverse: 'You Lash yourself across the gap and fall sideways, laughing.',
    meet: 'You went out into the storm for a stranger\'s child. Do you know how long I have waited for someone that stupid?',
    bond: 'Aeri spins around your head like a scrap of wind, delighted with everything, including you.',
    ideals: ['I will protect those who cannot protect themselves.', 'I will protect even those I hate, so long as it is right.', 'I accept that there will be those I cannot protect.'] },
  { id: 'skybreaker', name: 'Skybreakers', surges: ['gravitation', 'division'], sprenKind: 'highspren', spren: 'Kesh', shape: 'star', color: '#9fb6ff', dark: '#37408f', creed: 'Measure every act against the law.',
    desc: 'Judges with wings. They hunt the guilty through open air, and their Division burns away what the law condemns.',
    passive: { key: 'verdict', name: 'Verdict', desc: '+25% damage against foes charging a void cast.' }, stat: { atk: 1.1, def: .98, hp: .98, sl: 1 },
    ult: { name: 'Sentence Carried Out', desc: 'Pass judgment on all foes. Devastates foes who are charging.', pow: 3.3, type: 'light', status: { key: 'burn', turns: 3 } },
    traverse: 'You Lash yourself over the gap in a straight, lawful line.',
    meet: 'You broke curfew and a storm order to save that child. That is a violation. It is also the first interesting thing I have seen in a century.',
    bond: 'Kesh hangs in the air like a dark star with a hole in it and watches you for errors.',
    ideals: ['I will seek justice, to let it guide me, until I find a more perfect Ideal.', 'I will hold my own deeds to the measure I hold others\' to.', 'I will write down what the law should be, and answer for it.'] },
  { id: 'dustbringer', name: 'Dustbringers', surges: ['division', 'abrasion'], sprenKind: 'ashspren', spren: 'Cindra', shape: 'flame', color: '#ff9a5a', dark: '#8f3518', creed: 'Master the fire, and never let it master you.',
    desc: 'Feared and misunderstood. They burn stone to ash and slide through the fire, and they keep their power on a tight rein.',
    passive: { key: 'kindling', name: 'Kindling', desc: 'Basic strikes have a 30% chance to burn.' }, stat: { atk: 1.12, def: .95, hp: .97, sl: 1 },
    ult: { name: 'Ten Thousand Embers', desc: 'Turn the battlefield to ash, leaving friends unburned.', pow: 3.1, type: 'light', status: { key: 'burn', turns: 4 } },
    traverse: 'You burn a ledge of stone to steps of ash and skid across before they settle.',
    meet: 'Most people run from what I can do. You will have to learn to be afraid of it first. Then I will teach you not to be.',
    bond: 'Cindra crackles along your shoulder and leaves tiny scorch marks she refuses to apologise for.',
    ideals: ['I will hold my power and never let it hold me.', 'I will study each ruin I make until I understand it.', 'I will burn only what I have chosen and carry every ash.'] },
  { id: 'edgedancer', name: 'Edgedancers', surges: ['abrasion', 'progression'], sprenKind: 'cultivationspren', spren: 'Vinna', shape: 'vine', color: '#8ee87a', dark: '#2f7a3e', creed: 'Remember those who have been forgotten.',
    desc: 'Graceful, quick, and kind. They skate past blades on frictionless feet and heal the wounds nobody else stops to see.',
    passive: { key: 'remember', name: 'Those Forgotten', desc: 'At the start of each round, the most hurt ally heals 6% HP.' }, stat: { atk: 1, def: 1, hp: 1.05, sl: 1.05 },
    ult: { name: 'Dance of Green Blades', desc: 'Skate through all foes and leave healing in your wake.', pow: 2.7, type: 'slash', heal: 1.2 },
    traverse: 'You drop your friction to nothing and slide up the far wall on a growing vine.',
    meet: 'Everyone in town counted their own and shut the doors. You counted the one nobody counted. Oh, I am so glad I grew here.',
    bond: 'Vinna sprouts from the crem at your feet, curls around your wrist, and asks after your health again.',
    ideals: ['I will remember those who have been forgotten.', 'I will listen to those who have been ignored.', 'I will love those the world has already judged unlovable.'] },
  { id: 'truthwatcher', name: 'Truthwatchers', surges: ['progression', 'illumination'], sprenKind: 'mistspren', spren: 'Oreth', shape: 'mist', color: '#7fe8df', dark: '#1f6f78', creed: 'See what is, and say it, even when no one wants to hear.',
    desc: 'Quiet watchers who heal and foresee. They read the world\'s patterns and show others what they are refusing to look at.',
    passive: { key: 'foresight', name: 'Foresight', desc: 'Timing windows for blocks are wider, and you see what each foe will do next.' }, stat: { atk: .98, def: 1, hp: 1, sl: 1.15 },
    ult: { name: 'Everything at Once', desc: 'Show all foes the truth. Heals the party and stuns the weak.', pow: 2.5, type: 'light', heal: 1, status: { key: 'stun', turns: 1, chance: .7 } },
    traverse: 'You look at the gap until you see the handholds that were always there, then grow a bridge of moss along them.',
    meet: 'I watched you for three weeks before you went out that door. I will not tell you what else I saw. Not yet. Ask me again.',
    bond: 'Oreth drifts near you like a morning mist, and says very little that is not true.',
    ideals: ['I will seek the truth that others are afraid of.', 'I will share what I see even when it costs me their trust.', 'I will see myself as clearly as I see everyone else.'] },
  { id: 'lightweaver', name: 'Lightweavers', surges: ['illumination', 'transformation'], sprenKind: 'Cryptic', spren: 'Patternfold', shape: 'cryptic', color: '#e8a6ff', dark: '#6d2f8e', creed: 'Speak the truths you hide from yourself.',
    desc: 'Artists and liars. They weave false faces out of Stormlight and Soulcast the world, and every oath is a truth they hate admitting.',
    passive: { key: 'mirage', name: 'Mirage', desc: '15% chance for any attack on you to strike an illusion instead.' }, stat: { atk: 1, def: .96, hp: .97, sl: 1.15 },
    ult: { name: 'A World Painted Over', desc: 'Foes fight an illusion of the sky falling. Blinds them all.', pow: 2.9, type: 'light', status: { key: 'blind', turns: 3 } },
    traverse: 'You paint a bridge of light over the gap, believe in it very hard, and Soulcast the air beneath it.',
    meet: 'Mmm. You told yourself you were not brave. That is a lie. A lovely lie! Mmm. Tell me another, and we will begin.',
    bond: 'Patternfold ripples across your sleeve, a fractal that hums whenever you tell a lie.',
    ideals: ['I confess I am afraid of being seen.', 'I confess that I wear these faces so that no one will know me.', 'I confess I have been cruel to the person I was, and I will carry that person with me.'] },
  { id: 'elsecaller', name: 'Elsecallers', surges: ['transformation', 'transportation'], sprenKind: 'inkspren', spren: 'Sable', shape: 'ink', color: '#c9c9e8', dark: '#3a3a5e', creed: 'Reach your potential. Then reach further.',
    desc: 'Scholars of two worlds. They walk into Shadesmar at will and persuade the world to become something more useful.',
    passive: { key: 'scholar', name: 'Scholar\'s Reserve', desc: 'Recover 1 extra Stormlight every round.' }, stat: { atk: 1, def: .98, hp: .96, sl: 1.2 },
    ult: { name: 'Doorway of Beads', desc: 'Open Shadesmar beneath all foes and close it again.', pow: 3, type: 'pierce', status: { key: 'defDown', turns: 3 } },
    traverse: 'You step sideways into Shadesmar, walk three paces across the beads, and step out on the far side.',
    meet: 'I have reviewed your record. It is short and unimpressive, with one exception. I have decided the exception is a good start.',
    bond: 'Sable stands at your shoulder, sharp and black as a line of glyphs, and corrects your grammar.',
    ideals: ['I will become what I am capable of becoming.', 'I will learn from those I think beneath me.', 'I will spend what I have learned on others before I spend it on myself.'] },
  { id: 'willshaper', name: 'Willshapers', surges: ['transportation', 'cohesion'], sprenKind: 'Reacher', spren: 'Bronze', shape: 'reacher', color: '#f0be6e', dark: '#855a22', creed: 'No one chooses for you. No one.',
    desc: 'Wanderers and liberators. They walk between realms, shape stone with their hands, and answer to no master.',
    passive: { key: 'freedom', name: 'Unbound', desc: 'You cannot be stunned. Items are 30% stronger.' }, stat: { atk: 1.03, def: 1, hp: 1.02, sl: 1 },
    ult: { name: 'The Open Door', desc: 'Stone rises to carry foes elsewhere. Frees the party of ills.', pow: 3, type: 'crush', cleanse: true },
    traverse: 'You knead the cliff like clay and pull a road out of it.',
    meet: 'They told you to stay behind the door. You did not. I have been looking for someone who hears that sort of order and laughs.',
    bond: 'Bronze glints beside you like a floating coin of light, always pointing toward the horizon.',
    ideals: ['I will carry no one\'s chains, and I will break them for those who ask.', 'I will not make another into my servant, even for their good.', 'I will give up my own road if another\'s freedom asks it.'] },
  { id: 'stoneward', name: 'Stonewards', surges: ['cohesion', 'tension'], sprenKind: 'peakspren', spren: 'Grum', shape: 'stone', color: '#d2b48a', dark: '#6e5234', creed: 'Be there when you are needed.',
    desc: 'The steadiest of the Radiants. They reshape mountains and stiffen cloth into armor, and they stay until the last person is out.',
    passive: { key: 'bulwark', name: 'Bulwark', desc: 'You take 20% less damage. Foes prefer to attack you.' }, stat: { atk: .98, def: 1.25, hp: 1.15, sl: .95 },
    ult: { name: 'The Mountain Answers', desc: 'Peaks rise from the floor. Shields the party afterward.', pow: 2.8, type: 'crush', shield: true },
    traverse: 'You lay a palm on the rock. It sighs and rises into a bridge.',
    meet: 'You stayed. Everyone left and you stayed. Good. I am very bad at most things. I am very good at staying too.',
    bond: 'Grum wanders along the ground beside you, a rumbling little ridge with a dry sense of humour.',
    ideals: ['I will stand where I am needed, for as long as I am needed.', 'I will be the last to leave, every time.', 'I will let others carry me on the day I cannot stand.'] },
  { id: 'bondsmith', name: 'Bondsmiths', surges: ['tension', 'adhesion'], sprenKind: 'godspren fragment', spren: 'Vael', shape: 'bond', color: '#ffe08a', dark: '#8f6a18', creed: 'Unite, where the world would rather break.',
    desc: 'The rarest Order. They bind people, oaths, and even realms together. Their strength lies in everyone standing with them.',
    passive: { key: 'unity', name: 'Unity', desc: 'Resonance builds 50% faster for the whole party.' }, stat: { atk: 1, def: 1.05, hp: 1.03, sl: 1.05 },
    ult: { name: 'Unite Them', desc: 'Everyone strikes at once. Heals the party and raises their attack.', pow: 3, type: 'light', heal: .8, partyStatus: { key: 'atkUp', turns: 3 } },
    traverse: 'You bind this side of the gap to the other, and walk across on the idea that they belong together.',
    meet: 'There are so few of your kind that I had nearly stopped looking. You held out a hand in a storm. Let us see how far your hand can reach.',
    bond: 'Vael shines at your shoulder, a warm gold thread of light that always seems tied to someone else.',
    ideals: ['I will bind together those the world tore apart.', 'I will take responsibility for what I have done. If I must fall, I will rise each time a better man.', 'I will hold on when holding on hurts, and I will know when to let go.'] }
];
const ORDER = id => ORDERS.find(o => o.id === id);

const LOOKS = [
  { name: 'Alethi', skin: '#c9966c', skin2: '#a87850', hair: '#1b1820', style: 0, eye: '#3a2c20' },
  { name: 'Thaylen', skin: '#e6c4a2', skin2: '#c9a080', hair: '#f4f4ee', style: 1, eye: '#3e5f6c' },
  { name: 'Azish', skin: '#8a5a3c', skin2: '#6e452c', hair: '#120e12', style: 2, eye: '#241814' },
  { name: 'Horneater', skin: '#eed2b4', skin2: '#d0ae8c', hair: '#c04c2c', style: 3, eye: '#3b5c3a' },
  { name: 'Reshi', skin: '#b58a60', skin2: '#946d48', hair: '#1a2e2c', style: 4, eye: '#2c2a1a' },
  { name: 'Herdazian', skin: '#9c6e4c', skin2: '#7e5638', hair: '#2c1c14', style: 1, eye: '#2a1c12' }
];

const COMPANIONS = {
  torvan: { id: 'torvan', name: 'Torvan', role: 'Sergeant', wClass: 'spear', base: { hp: 92, sl: 9, atk: 12, def: 7 }, grow: { hp: 15, sl: 1, atk: 2.4, def: 1.6 }, attackType: 'pierce', attackName: 'Spear Thrust', secondType: 'crush',
    skills: [['shieldbash', 1], ['bridgewall', 3], ['spearwall', 5], ['rally', 8]], res: 'Focus',
    pal: { skin: '#a87850', skin2: '#8a6040', hair: '#231c1c', style: 3, eye: '#2a2018', coat: '#54633e', coat2: '#3e4b2e', trim: '#b5a26a', pants: '#3a3226', boots: '#241c14', scar: true } },
  issa: { id: 'issa', name: 'Issa', role: 'Artifabrian', wClass: 'fabrial', base: { hp: 66, sl: 14, atk: 13, def: 4 }, grow: { hp: 10, sl: 3, atk: 2.8, def: .9 }, attackType: 'light', attackName: 'Sphere Shot', secondType: 'pierce',
    skills: [['painrial', 1], ['flarelamp', 2], ['snare', 4], ['overcharge', 7]], res: 'Charge',
    pal: { skin: '#e6c4a2', skin2: '#c9a080', hair: '#ececea', style: 4, eye: '#37606c', coat: '#7c3f52', coat2: '#5a2c3c', trim: '#dcae58', pants: '#2c2a3e', boots: '#1e1a28', goggles: true } }
};
const HERO_BASE = { base: { hp: 80, sl: 12, atk: 13, def: 5 }, grow: { hp: 13, sl: 2, atk: 2.6, def: 1.2 } };

const ITEMS = {
  chouta: { name: 'Chouta', kind: 'use', target: 'ally', heal: 60, price: 18, desc: 'Herdazian street food. Heals 60 HP.' },
  stew: { name: 'Horneater Stew', kind: 'use', target: 'ally', heal: 160, price: 45, desc: 'Do not ask what is in it. Heals 160 HP.' },
  lavis: { name: 'Lavis Porridge Pot', kind: 'use', target: 'allies', heal: 70, price: 60, desc: 'Plain, hot, plentiful. Heals the party 70 HP.' },
  chip: { name: 'Infused Chip', kind: 'use', target: 'ally', sl: 8, price: 20, desc: 'A small glowing sphere. Restores 8 Stormlight.' },
  mark: { name: 'Infused Mark', kind: 'use', target: 'ally', sl: 22, price: 55, desc: 'A bright sphere. Restores 22 Stormlight.' },
  broam: { name: 'Infused Broam', kind: 'use', target: 'allies', sl: 18, price: 120, desc: 'Restores 18 Stormlight to the party.' },
  regrowthvial: { name: 'Regrowth Vial', kind: 'use', target: 'ally', revive: .5, price: 70, desc: 'Lifespren in a jar. Revives an ally at 50% HP.' },
  fireflask: { name: 'Fire Flask', kind: 'use', target: 'foes', dmg: 60, price: 35, desc: 'Deals 60 damage to all foes.' },
  // Gear
  sword1: { name: 'Sidesword', kind: 'gear', slot: 'weapon', who: 'hero', atk: 4, price: 60, desc: 'Plain and well kept. ATK +4.' },
  sword2: { name: 'Sellsword\'s Steel', kind: 'gear', slot: 'weapon', who: 'hero', atk: 9, price: 180, desc: 'Good Azish steel. ATK +9.' },
  sword3: { name: 'Stormetched Blade', kind: 'gear', slot: 'weapon', who: 'hero', atk: 15, price: 420, desc: 'Lightning-marked. ATK +15.' },
  spear1: { name: 'Bridgeman\'s Spear', kind: 'gear', slot: 'weapon', who: 'torvan', atk: 4, price: 55, desc: 'Well-balanced. ATK +4.' },
  spear2: { name: 'Ironbound Spear', kind: 'gear', slot: 'weapon', who: 'torvan', atk: 9, price: 170, desc: 'Heavy and honest. ATK +9.' },
  spear3: { name: 'Sky-ash Spear', kind: 'gear', slot: 'weapon', who: 'torvan', atk: 15, price: 410, desc: 'Light as a promise. ATK +15.' },
  rig1: { name: 'Tin Fabrial Rig', kind: 'gear', slot: 'weapon', who: 'issa', atk: 4, price: 60, desc: 'Bits of Issa\'s own work. ATK +4.' },
  rig2: { name: 'Heliodor Rig', kind: 'gear', slot: 'weapon', who: 'issa', atk: 9, price: 180, desc: 'Sharper focus. ATK +9.' },
  rig3: { name: 'Emerald Conjoiner', kind: 'gear', slot: 'weapon', who: 'issa', atk: 15, price: 420, desc: 'Guild-grade. ATK +15.' },
  coat1: { name: 'Quilted Coat', kind: 'gear', slot: 'armor', def: 3, hp: 10, price: 50, desc: 'DEF +3, HP +10.' },
  coat2: { name: 'Carapace Vest', kind: 'gear', slot: 'armor', def: 7, hp: 25, price: 160, desc: 'Chull shell plates. DEF +7, HP +25.' },
  coat3: { name: 'Stormwarden Mail', kind: 'gear', slot: 'armor', def: 12, hp: 50, price: 400, desc: 'DEF +12, HP +50.' },
  charm1: { name: 'Glyphward', kind: 'gear', slot: 'charm', hp: 25, price: 80, desc: 'A prayer tied around the arm. HP +25.' },
  charm2: { name: 'Sphere Pouch', kind: 'gear', slot: 'charm', sl: 5, price: 130, desc: 'Stormlight +5.' },
  charm3: { name: 'Painspren Ward', kind: 'gear', slot: 'charm', def: 4, atk: 4, price: 260, desc: 'ATK +4, DEF +4.' },
  charm4: { name: 'Herald\'s Token', kind: 'gear', slot: 'charm', atk: 8, sl: 8, price: 0, desc: 'Found in the deep. ATK +8, Stormlight +8.' }
};
const SHOP_STOCK = {
  1: ['chouta', 'chip', 'lavis', 'sword1', 'spear1', 'rig1', 'coat1', 'charm1'],
  2: ['chouta', 'stew', 'chip', 'mark', 'lavis', 'regrowthvial', 'fireflask', 'sword2', 'spear2', 'rig2', 'coat2', 'charm2'],
  3: ['stew', 'mark', 'broam', 'lavis', 'regrowthvial', 'fireflask', 'sword3', 'spear3', 'rig3', 'coat3', 'charm3']
};

// moves: kind melee|ranged|aoe. charged: uses void seals (sigils) that party hits can break.
const ENEMIES = {
  cremling: { name: 'Cremling', hp: 30, atk: 10, def: 2, xp: 14, gold: 6, weak: ['crush'], moves: [{ name: 'Nip', pow: 1, kind: 'melee' }] },
  axehound: { name: 'Axehound', hp: 48, atk: 13, def: 3, xp: 22, gold: 9, weak: ['pierce'], moves: [{ name: 'Bite', pow: 1, kind: 'melee' }, { name: 'Savage', pow: 1.3, kind: 'melee', w: .4 }] },
  deserter: { name: 'Deserter', hp: 62, atk: 15, def: 5, xp: 30, gold: 18, weak: ['slash'], moves: [{ name: 'Rusty Cut', pow: 1, kind: 'melee' }, { name: 'Thrown Knife', pow: .85, kind: 'ranged', w: .5 }], charged: { name: 'Crossbow Volley', pow: 1.3, kind: 'aoe', sigils: ['slash'], turns: 2, every: 4 } },
  lurg: { name: 'Lurg', hp: 72, atk: 18, def: 5, xp: 40, gold: 14, weak: ['slash'], moves: [{ name: 'Tongue Lash', pow: 1, kind: 'ranged' }, { name: 'Slam', pow: 1.15, kind: 'melee' }] },
  chull: { name: 'Feral Chull', hp: 120, atk: 18, def: 13, xp: 52, gold: 20, weak: ['light', 'crush'], resist: ['slash'], moves: [{ name: 'Claw', pow: 1, kind: 'melee' }], charged: { name: 'Shell Rampage', pow: 1.5, kind: 'aoe', sigils: ['crush', 'crush'], turns: 2, every: 3 } },
  scout: { name: 'Singer Scout', hp: 92, atk: 21, def: 7, xp: 58, gold: 30, weak: ['pierce'], moves: [{ name: 'Axe Swing', pow: 1, kind: 'melee' }, { name: 'Hooked Spear', pow: 1, kind: 'ranged' }], charged: { name: 'Rhythm of War', pow: 1.4, kind: 'aoe', sigils: ['slash', 'pierce'], turns: 2, every: 4 } },
  whitespine: { name: 'Whitespine', hp: 175, atk: 25, def: 8, xp: 90, gold: 35, weak: ['slash', 'light'], moves: [{ name: 'Tusk Gore', pow: 1, kind: 'melee' }, { name: 'Pounce', pow: 1.25, kind: 'melee', w: .5 }], charged: { name: 'Stalking Charge', pow: 1.7, kind: 'single', sigils: ['pierce', 'crush'], turns: 2, every: 3 } },
  warform: { name: 'Warform Singer', hp: 150, atk: 29, def: 13, xp: 110, gold: 45, weak: ['crush'], resist: ['slash'], moves: [{ name: 'Hammer Blow', pow: 1, kind: 'melee' }, { name: 'Carapace Charge', pow: 1.2, kind: 'melee', w: .5 }], charged: { name: 'Battle Rhythm', pow: 1.4, kind: 'aoe', sigils: ['crush', 'slash'], turns: 2, every: 4 } },
  voidwisp: { name: 'Voidspren', hp: 85, atk: 27, def: 4, xp: 85, gold: 25, weak: ['light'], resist: ['crush', 'pierce'], moves: [{ name: 'Hissing Touch', pow: 1, kind: 'ranged', status: { key: 'burn', turns: 2, chance: .4 } }], charged: { name: 'Whisper of Odium', pow: 1.3, kind: 'aoe', sigils: ['light'], turns: 2, every: 3 } },
  regal: { name: 'Stormform Regal', hp: 220, atk: 31, def: 13, xp: 150, gold: 70, weak: ['pierce', 'light'], moves: [{ name: 'Red Lightning', pow: 1.1, kind: 'ranged' }, { name: 'Storm Fist', pow: 1, kind: 'melee' }], charged: { name: 'Storm Call', pow: 1.6, kind: 'aoe', sigils: ['light', 'pierce', 'crush'], turns: 2, every: 3 } },
  shade: { name: 'Bead Shade', hp: 185, atk: 33, def: 14, xp: 150, gold: 55, weak: ['light', 'slash'], moves: [{ name: 'Glass Claw', pow: 1, kind: 'melee' }, { name: 'Bead Hail', pow: .9, kind: 'ranged' }] },
  angerspren: { name: 'Boiling Angerspren', hp: 150, atk: 37, def: 10, xp: 145, gold: 45, weak: ['pierce'], moves: [{ name: 'Scald', pow: 1, kind: 'ranged', status: { key: 'burn', turns: 2, chance: .6 } }], charged: { name: 'Boiling Over', pow: 1.5, kind: 'aoe', sigils: ['pierce', 'light'], turns: 2, every: 3 } },
  hollow: { name: 'Hollowed Fused', hp: 310, atk: 38, def: 16, xp: 240, gold: 90, weak: ['slash', 'light'], moves: [{ name: 'Dead Hand', pow: 1, kind: 'melee' }, { name: 'Void Lance', pow: 1.15, kind: 'ranged' }], charged: { name: 'Passion Flood', pow: 1.6, kind: 'aoe', sigils: ['slash', 'light', 'crush'], turns: 2, every: 3 } },
  // Bosses
  hadrin: { name: 'Captain Hadrin', boss: true, hp: 620, atk: 18, def: 9, xp: 260, gold: 160, weak: ['crush'], resist: ['slash'], moves: [{ name: 'Maul Sweep', pow: 1, kind: 'melee' }, { name: 'Plate Charge', pow: 1.25, kind: 'melee', w: .6 }], charged: { name: 'Earthbreaker', pow: 1.5, kind: 'aoe', sigils: ['crush', 'pierce'], turns: 2, every: 3 } },
  chasmfiend: { name: 'Chasmfiend', boss: true, hp: 1500, atk: 27, def: 11, xp: 620, gold: 320, weak: ['pierce', 'light'], moves: [{ name: 'Foreleg Stab', pow: 1, kind: 'melee' }, { name: 'Crushing Claw', pow: 1.25, kind: 'melee', w: .6 }, { name: 'Sweep', pow: .8, kind: 'aoe', w: .7 }], charged: { name: 'Thrumming Roar', pow: 1.8, kind: 'aoe', sigils: ['pierce', 'slash', 'crush', 'light'], turns: 3, every: 4 }, summon: { at: .5, id: 'lurg', n: 1 } },
  cantor: { name: 'The Ashen Cantor', boss: true, hp: 2300, atk: 34, def: 16, xp: 950, gold: 500, weak: ['light'], moves: [{ name: 'Ash Lance', pow: 1, kind: 'ranged' }, { name: 'Rhythm of Spite', pow: .8, kind: 'aoe' }, { name: 'Cinder Palm', pow: 1.25, kind: 'melee', status: { key: 'burn', turns: 2, chance: .5 } }], charged: { name: 'Song of the Unmade', pow: 1.8, kind: 'aoe', sigils: ['light', 'slash', 'pierce', 'light'], turns: 3, every: 4 }, summon: { at: .5, id: 'voidwisp', n: 2 } },
  hunter: { name: 'The Glass Hunter', boss: true, hp: 2900, atk: 39, def: 18, xp: 1300, gold: 700, weak: ['crush', 'light'], moves: [{ name: 'Obsidian Spear', pow: 1.1, kind: 'melee' }, { name: 'Bead Storm', pow: .85, kind: 'aoe' }], charged: { name: 'Cognitive Severance', pow: 1.9, kind: 'aoe', sigils: ['crush', 'light', 'crush', 'pierce'], turns: 3, every: 4 }, summon: { at: .5, id: 'shade', n: 2 } },
  thunderclast: { name: 'Thunderclast', boss: true, hp: 3100, atk: 41, def: 20, xp: 1500, gold: 500, weak: ['pierce', 'crush'], resist: ['slash'], moves: [{ name: 'Stone Fist', pow: 1.1, kind: 'melee' }, { name: 'Boulder Rain', pow: .85, kind: 'aoe' }], charged: { name: 'Red Lightning Maw', pow: 2, kind: 'aoe', sigils: ['pierce', 'crush', 'pierce', 'crush'], turns: 3, every: 4 } },
  cantor2: { name: 'Cantor, Everstorm-Crowned', art: 'cantor', boss: true, hp: 3800, atk: 44, def: 20, xp: 0, gold: 0, weak: ['light'], moves: [{ name: 'Ash Lance', pow: 1.05, kind: 'ranged' }, { name: 'Rhythm of Spite', pow: .9, kind: 'aoe' }, { name: 'Unmaking Palm', pow: 1.3, kind: 'melee', status: { key: 'burn', turns: 2, chance: .6 } }], charged: { name: 'The Final Verse', pow: 2.1, kind: 'aoe', sigils: ['light', 'slash', 'crush', 'pierce', 'light'], turns: 3, every: 4 }, summon: { at: .4, id: 'regal', n: 1 } }
};

const FORMS = {
  crags: [['cremling', 'cremling'], ['axehound'], ['deserter', 'cremling'], ['axehound', 'cremling', 'cremling'], ['deserter', 'deserter']],
  chasm: [['lurg', 'lurg'], ['chull', 'lurg'], ['scout'], ['scout', 'lurg'], ['whitespine']],
  vault: [['warform', 'warform'], ['voidwisp', 'warform'], ['regal'], ['voidwisp', 'voidwisp', 'voidwisp']],
  shadesmar: [['shade', 'shade'], ['angerspren', 'shade'], ['angerspren', 'angerspren', 'angerspren'], ['hollow']]
};

function newHero(name, orderId, lookIdx) {
  return { id: 'hero', name, lvl: 1, xp: 0, equip: { weapon: null, armor: null, charm: null }, order: orderId, look: lookIdx };
}
function newComp(id, lvl) { return { id, name: COMPANIONS[id].name, lvl, xp: 0, equip: { weapon: null, armor: null, charm: null } }; }
function xpNeed(lvl) { return 45 + lvl * lvl * 22; }
function heroDef(h) { return h.id === 'hero' ? HERO_BASE : COMPANIONS[h.id]; }
// Derived stats. Ideals grant the living Shardblade (third) and Plate (fourth).
function stats(h, ideal) {
  const d = heroDef(h), mul = h.id === 'hero' ? ORDER(h.order).stat : { hp: 1, sl: 1, atk: 1, def: 1 }, l = h.lvl - 1;
  const s = { hp: (d.base.hp + d.grow.hp * l) * mul.hp, sl: (d.base.sl + d.grow.sl * l) * mul.sl, atk: (d.base.atk + d.grow.atk * l) * mul.atk, def: (d.base.def + d.grow.def * l) * mul.def };
  for (const k of ['weapon', 'armor', 'charm']) { const it = h.equip[k] && ITEMS[h.equip[k]]; if (it) for (const st of ['hp', 'sl', 'atk', 'def']) if (it[st]) s[st] += it[st]; }
  if (h.id === 'hero') {
    if (ideal >= 2) { s.sl += 4; s.hp += 10; }
    if (ideal >= 3) { s.atk += 9; s.sl += 4; }
    if (ideal >= 4) { s.def += 10; s.hp += 40; s.sl += 6; }
  }
  for (const k in s) s[k] = Math.round(s[k]);
  return s;
}
function heroSkills(h, ideal) {
  if (h.id !== 'hero') return COMPANIONS[h.id].skills.filter(q => q[1] <= h.lvl).map(q => q[0]);
  const o = ORDER(h.order), [A, B] = o.surges.map(id => SURGES[id]), out = [];
  if (ideal >= 1) out.push(A.a);
  if (ideal >= 2) out.push(B.a);
  if (ideal >= 3) out.push(A.b);
  if (ideal >= 4) out.push(B.b);
  return out;
}
