'use strict';
// Story scripts: coroutines run by Game.run(). Plot and characters are original to this fan game.
const SPEAK = {
  torvan: { name: 'Torvan', pal: COMPANIONS.torvan.pal, key: 'torvan' }, issa: { name: 'Issa', pal: COMPANIONS.issa.pal, key: 'issa' },
  elder: { name: 'Highmarshal Dorvan', pal: NPC_PALS.elder, key: 'elder' }, mother: { name: 'Ralna', pal: NPC_PALS.mother, key: 'mother' }, child: { name: 'Pell', pal: NPC_PALS.child, key: 'child' },
  merchant: { name: 'Azim the Trader', pal: NPC_PALS.merchant, key: 'merchant' }, inn: { name: 'Big Rolo', pal: NPC_PALS.inn, key: 'inn' }, villager: { name: 'Refugee', pal: NPC_PALS.villager, key: 'villager' }, villager2: { name: 'Stormwatcher', pal: NPC_PALS.villager2, key: 'villager2' },
  farmer: { name: 'Old Farmer', pal: NPC_PALS.villager, key: 'villager' }, hadrin: { name: 'Captain Hadrin', pal: NPC_PALS.hadrin, key: 'hadrin' }, cantor: { name: 'The Ashen Cantor', pal: NPC_PALS.cantor, key: 'cantor' },
  sprenElder: { name: 'Elder Honorspren', pal: { skin: '#d4f0ff', skin2: '#8fbfe0', hair: '#c4e8ff', style: 1, eye: '#2a4a7a', coat: '#8fbfe0', coat2: '#5f8fb8', trim: '#ffffff' }, key: 'sprenelder' }
};
function setQuest(txt, map, x, y) { S.quest = txt; S.marker = map ? [map, x, y] : null; }
function fmt(s) {
  const o = ORDER(S.party[0].order);
  return s.replace(/\{name\}/g, S.party[0].name).replace(/\{spren\}/g, o.spren).replace(/\{kind\}/g, o.sprenKind).replace(/\{order\}/g, o.name).replace(/\{one\}/g, o.name.slice(0, -1));
}
function* say(who, txt) { yield* Dialog.show(who, fmt(txt)); }
function* narr(txt) { yield* Dialog.show(null, fmt(txt)); }
function give(item, n = 1) { S.items[item] = (S.items[item] || 0) + n; }
function* announce(t) { yield* Dialog.show('sys', fmt(t)); }

const Story = {
  // ---------- prologue ----------
  *newGame() {
    Game.scene = CineScene; CineScene.back = 'storm'; CineScene.lines = null; Weather.set('storm');
    Music.play('deep');
    yield* Game.fadeIn(.8);
    yield* CineScene.caption(['Roshar. A world of stone and storm.', 'Every few days, the highstorm crosses the land from the east.', 'People shelter. Plants pull back into their shells. Spheres left out overnight drink in its Light.']);
    yield* CineScene.caption(['Long ago, ten Orders of Knights Radiant swore oaths to spren, and were given power over the Surges of the world.', 'Then, in one day, they broke their oaths and walked away. No one remembers why.']);
    yield* CineScene.caption(['Now, in the far Frostlands, in the storm town of Stonereach...']);
    yield* Game.fadeOut(.6);
    S.flags.prologue = 1;
    Game.enterMap('stonereach', 12, 17);
    Game.scene = FieldScene;
    yield* Game.fadeIn(.6);
    Field.player.dir = 2;
    yield* wait(.4);
    yield* narr('The storm bell has been ringing for an hour. The highstorm is early. Everyone in Stonereach is behind their doors.');
    yield* say('mother', 'Pell! Has anyone seen my boy? He ran for the storm gate after a loose chull! Please, somebody! Please!');
    yield* narr('You are nobody in this town: a hired caravan guard with no one to go home to. All the shutters stay closed.');
    yield* narr('You look east. Then you run.');
    setQuest('Find Pell at the storm gate!', 'stonereach', 44, 17);
  },
  *prologueStorm() {
    const child = Field.npcBy('child2');
    yield* say('child', 'I can\'t move! The wind, the wind keeps...');
    yield* narr('You reach the boy and throw your coat around him. Behind you the sky turns to a wall of water and flying stone.');
    Sfx.play('thunder'); Weather.flash = 1; Field.shake = 1.2;
    yield* wait(.6);
    Sfx.play('thunder'); Field.shake = 1.5; Game.flashCol = '#d8e8ff'; Game.flashA = 1;
    yield* wait(.5);
    yield* Game.fadeOut(.5);
    yield* wait(.5);
    const o = ORDER(S.party[0].order);
    Game.scene = VoidScene; VoidScene.o = o; VoidScene.showSpren = true; Music.play('oath');
    yield* Game.fadeIn(.7);
    yield* narr('Darkness. No wind. A small light, hanging in the air where no light should be.');
    yield* say('spren', o.meet);
    yield* say('spren', 'I am {spren}. There are words. They are old, and they are the first ones everyone must say. They will not save you. You will have to do that afterward.');
    yield* Story.oath(1);
    yield* Game.fadeOut(.5);
    Game.scene = FieldScene;
    Field.shake = .3;
    delete S.flags.torvanTmp;
    yield* Game.fadeIn(.4);
    yield* narr('You stand in the storm. The stones that hit you bounce away. Stormlight rises from your skin like steam.');
    yield* narr('Two shapes come snarling through the rain: storm-maddened beasts, drawn to the only warm thing for a mile.');
    yield* Battle.run(['axehound', 'cremling'], { noFlee: true, back: 'storm', music: 'battle' });
    S.flags.ringKnown = 1; S.flags.blockKnown = 1;
    yield* Game.fadeOut(.6);
    delete S.flags.prologue;
    Weather.set('none');
    S.party[0].hp = stats(S.party[0], S.ideal).hp;
    Game.enterMap('stonereach', 6, 20);
    Game.scene = FieldScene;
    yield* Game.fadeIn(.8);
    yield* narr('Morning. The town has been scrubbed raw. Rockbuds open cautiously, and a boy eats porridge beside his mother as though nothing happened.');
    yield* say('mother', 'You. It was you. They said no one could... your eyes. Stormfather, look at your eyes.');
    yield* say('child', 'You were glowing! And there was a little {kind}! It talks!');
    yield* say('spren', 'I can hear him. He is correct. ' + (o.id === 'edgedancer' ? 'How is your head, by the way? Did you eat?' : 'Do try to act as though this is normal.'));
    yield* say('mother', 'The Highmarshal is asking for you. At the hall in the middle of town. Go on. And... thank you.');
    setQuest('See Highmarshal Dorvan at the town hall', 'stonereach', 30, 16);
    Game.save();
  },
  // ---------- the oath scene ----------
  *oath(n) {
    const o = ORDER(S.party[0].order);
    const words = n === 1 ? ['Life before death.', 'Strength before weakness.', 'Journey before destination.'] : [o.ideals[n - 2]];
    const title = ['The First Ideal', 'The Second Ideal', 'The Third Ideal', 'The Fourth Ideal'][n - 1];
    const prevMusic = Music.cur;
    Music.play('oath');
    const prevScene = Game.scene;
    Game.scene = OathScene;
    OathScene.begin(o, title, words);
    Sfx.play('oath');
    yield* OathScene.play();
    const before = heroSkills(S.party[0], S.ideal);
    S.ideal = n;
    const st = stats(S.party[0], n); S.party[0].hp = st.hp; S.party[0].sl = st.sl;
    const added = heroSkills(S.party[0], n).filter(x => !before.includes(x));
    OathScene.gains = added.map(id => `New Surge ability: ${SKILLS[id].name}`);
    if (n === 1) OathScene.gains.push('Your wounds now knit themselves with Stormlight.');
    if (n === 3) OathScene.gains.push(`${o.spren} becomes your living Shardblade.`, `Resonance unlocked: ${o.ult.name}`);
    if (n === 4) OathScene.gains.push('Living Shardplate grows over you. DEF and HP greatly raised.');
    OathScene.gains.push(n === 1 ? `Passive: ${o.passive.name}` : 'Your Stormlight deepens.');
    yield* OathScene.afterglow();
    Game.scene = prevScene;
    Music.play(prevMusic);
  },
  // ---------- Stonereach ----------
  *elderTalk() {
    const f = S.flags;
    if (!f.elderDone) {
      yield* say('elder', 'So. The rumors walk on two legs. I have read about your kind. Every book agrees that you are traitors, and that you are the only people who could help me.');
      yield* say('elder', 'My stormwatchers read the charts wrong for the first time in thirty years. They say a second storm is coming. It blows from the west, the wrong way, and its lightning is red.');
      yield* say('elder', 'It will cross the Frostlands in three days. These walls face east. They will not stop it. Four thousand people live in this valley, and there is nowhere for them to go.');
      yield* say('torvan', 'Permission to speak, Highmarshal? I was a bridge sergeant before this. If there\'s somewhere to run, I\'ll carry anyone there on my back. Is there anywhere?');
      yield* say('elder', 'Perhaps. There is a Thaylen woman in the old workshop who has been pestering my clerks about a map. Speak with her. Sergeant Torvan, you are reassigned.');
      f.elderDone = 1;
      setQuest('Speak with the Thaylen artifabrian, Issa, at the workshop', 'stonereach', 36, 16);
    } else if (!S.flags.hadrinDown) yield* say('elder', 'Three days. I will have the families packed and ready. Bring me a door they can walk through.');
    else yield* say('elder', 'They are all packed. They ask about you, you know. They have started saying the old titles. Keep going.');
  },
  *torvanTalk() { yield* say('torvan', S.flags.elderDone ? 'I\'ll come with you once we know where we\'re headed. Go on, see the Thaylen.' : 'The Highmarshal\'s in the hall. Best not to keep him waiting. Good hands, by the way, out there in the storm. Stupid, but good.'); },
  *issaTalk() {
    if (!S.flags.elderDone) { yield* say('issa', 'Careful of the wires. I am busy, and you would have to be someone important for me to stop being busy. Talk to the Highmarshal, yes?'); return; }
    yield* say('issa', 'Ah! The glowing one. Sit. Do not touch that. It is a heating fabrial and you will regret it.');
    yield* say('issa', 'Look. This is a survey older than the Hierocracy. Here: the Vault of Oaths, past the Sundered Deep. And in it, a dais with ten glyphs.');
    yield* say('issa', 'An Oathgate. A real one. It can send whoever stands on it across the world, to the tower they call Urithiru, in a single breath.');
    yield* say('spren', 'She is right. I remember that tower. I remember it... a little. Oathgates only answer to a Radiant, or to one who has sworn. Your timing is good.');
    yield* say('issa', 'Between us and the Vault are the Windbreak Crags, full of deserters, and then the chasms. I am coming with you. Who else can wake a thing that old? You? You cannot even read.');
    yield* say('torvan', 'I\'ll carry the bags, then. And the spears. And probably the Thaylen.');
    yield* announce('Torvan and Issa joined the party!');
    S.party.push(newComp('torvan', S.party[0].lvl), newComp('issa', S.party[0].lvl));
    for (const h of S.party) { const st = stats(h, S.ideal); h.hp = st.hp; h.sl = st.sl; }
    give('chouta', 3); give('chip', 2);
    S.flags.torvanJoined = 1; S.flags.issaJoined = 1; S.nodes.crags = 1;
    yield* announce('Received Chouta x3 and Infused Chip x2. Press MENU (C) to manage your party and gear.');
    setQuest('Leave by the west gate, for Windbreak Crags', 'stonereach', 0, 17);
    Game.save();
  },
  *innTalk() { yield* say('inn', S.flags.hadrinDown ? 'Eat something, little Radiant! You look like a chull run over a chull. Rest by the fire, on the house.' : 'Ha! Radiants at my door, and the world ending! I will not be moving my kettle. It is a very good kettle.'); },
  *motherTalk() { yield* say('mother', 'We are packed. Bring us a way out. Pell has drawn you on the wall. He got the glow right.'); },
  *childTalk() { yield* say('child', 'When I grow up I\'m going to be a {one}! Or a chull! Mama says choose one.'); },
  *villagerA() { yield* say('villager', 'Hold the plants still as you walk? You cannot. Rockbuds flinch from every foot in Roshar. My wife says it is the only politeness left.'); },
  *villagerB() { yield* say('villager2', 'Thirty years of charts. Now the winds come out of the west at dawn. Do you know how that feels? Like the sun coming up wrong.'); },
  *villagerC() { yield* say('farmer', 'My grandmother told me never to trust a glowing knight. Her grandmother too. Then again, they never told me what to do about a red storm.'); },
  *shop() { yield* Game.shop(S.flags.hadrinDown ? 2 : 1); },
  *shop2() { yield* say('merchant', 'What? Business is excellent in a chasm. No competition.'); yield* Game.shop(2); },
  *shop3() { yield* Game.shop(3); },
  // ---------- camp ----------
  *camp() {
    const pick = yield* Dialog.choice('A sphere-warmed camp. What will you do?', ['Rest and save', 'Talk by the fire', 'Leave']);
    if (pick === 0) {
      yield* Game.fadeOut(.4);
      for (const h of S.party) { const st = stats(h, S.ideal); h.hp = st.hp; h.sl = st.sl; }
      S.cleared[Game.mapDef.id] = [];
      Field.rebuildFoes();
      Game.save(); Sfx.play('heal');
      yield* wait(.3);
      yield* Game.fadeIn(.4);
      yield* announce('The party rests. HP and Stormlight restored. Game saved. Creatures have wandered back in the meantime.');
    } else if (pick === 1) yield* Story.campTalk();
  },
  *campTalk() {
    const o = ORDER(S.party[0].order), id = Game.mapDef.id;
    const T = {
      stonereach: [['torvan', 'Three days. I carried bridges for a highprince who wouldn\'t have noticed if I fell. These people notice. It\'s a heavier load. Better, though.'], ['issa', 'I have counted the sphere stock. We will need your Stormlight for the gate, and all of it. Do try to save some.']],
      crags: [['torvan', 'Those men up there used to be soldiers. Could\'ve been my squad. Hunger does most of the deserting for you. Doesn\'t make what they took from the refugees right.'], ['issa', 'A fabrial is a spren in a cage, you know. I have always told myself they do not mind. Your little friend looks at my gemstones in a way that I do not enjoy.'], ['spren', o.bond]],
      chasm: [['torvan', 'Used to run these. Well, not these. Same idea. You learn to listen. When the walls start humming, you find yourself a very small hole.'], ['issa', 'The lamps down here are old work, fine as anything I have seen in Thaylen City. Whoever built them expected to come back.'], ['spren', 'The ones who walked away. My kin called it the Recreance. I do not have many words about it. I would like to keep this one.']],
      vault: [['issa', 'They built this place for all ten Orders. Ten doors, ten statues. Then one day, everyone just stopped coming. Can you imagine? Leaving it all behind?'], ['torvan', 'I can. It\'s the coming back I can\'t figure.'], ['spren', o.creed + ' That is what your Order says. I think you may mean it. It is a strange feeling, being sure of someone.']],
      shadesmar: [['torvan', 'So every bead down there is something in the real world? Every one? Somewhere there\'s a bead that\'s my left boot. Don\'t step on it.'], ['issa', 'I am standing inside the theory of everything I have ever built. And all I want is a sandwich. That is a disappointing thing to learn about myself.'], ['spren', 'I look different here, I know. Bigger. This is the real me. You do not have to get used to it. It is enough if you say hello.']]
    }[id] || [];
    for (const [who, line] of T) yield* say(who, line);
  },
  // ---------- leaving an area for the world map ----------
  *toWorld() {
    if (S.flags.prologue || !S.nodes.crags) {
      yield* narr(S.flags.prologue ? 'You cannot leave anyone behind in this storm.' : 'The road out is dangerous. You should find out what the town needs first.');
      Field.player.x += 20;
      return;
    }
    if (S.map === 'stonereach' && !S.flags.leftTown) { S.flags.leftTown = 1; setQuest('Cross Windbreak Crags', 'crags', 14, 15); }
    yield* Game.toWorld(S.map);
  },
  // ---------- crags ----------
  *cragsIntro() {
    yield* say('torvan', 'Windbreak. Wind scours this place to bare stone, so the plants here are quick. Watch the rockbuds shut when you get close. Rest at any fire you find: it\'s the only way you\'ll keep moving.');
    yield* say('issa', 'That pit ahead. How do we cross that, my Radiant? There is a shining spot on the edge. Your {kind} seems very keen on it.');
    yield* say('spren', 'Stand at a shining spot and press OK. Use your Surges. That is why you have them.');
    setQuest('Cross the gap and find the deserter camp', 'crags', 65, 14);
  },
  *hadrinScene() {
    Field.lock();
    yield* say('hadrin', 'Well, well. I had reports of a glowing fool on the road. I\'ve got Plate from a dead Shardbearer here, and I\'ve got forty men and a stolen grain train. You\'ve got... a Thaylen and a sergeant.');
    yield* say('torvan', 'Hadrin. You took food off refugees. There are children going hungry for this.');
    yield* say('hadrin', 'And my men are not hungry! That is what a captain does, bridgeboy. A red storm is coming and everyone is going to die. I will at least do it fed.');
    yield* say('spren', 'He is wearing a dead oath as armor. I do not like it. Hit him with something that crushes, and watch for when he winds up.');
    const r = yield* Battle.run(['hadrin', 'deserter'], { noFlee: true });
    if (r === 'lose') return;
    S.flags.hadrinDown = 1;
    yield* narr('Hadrin drops to one knee. The stolen Plate cracks along the seams and goes dark. Around you, his men have lowered their spears.');
    yield* say('hadrin', 'Well. Go on, then. Everyone\'s got a right to it.');
    const c = yield* Dialog.choice('What will you do with Hadrin?', ['Spare him: "There are people who need soldiers."', 'Take the grain and leave him to the law.']);
    if (c === 0) {
      S.flags.hadrinSpared = 1;
      yield* say('hero', 'There are four thousand people in that valley, and no one to walk them out. Bring back the grain. Then pick up your spear and be a captain.');
      yield* say('hadrin', '...You\'re serious. Storm you. You\'re actually serious.');
    } else {
      S.flags.hadrinJailed = 1;
      yield* say('hero', 'You will answer in Stonereach, in front of the people you stole from.');
      yield* say('hadrin', 'Then you\'d better hurry. There won\'t be a Stonereach to answer to.');
      S.gold += 150;
    }
    yield* say('spren', 'I can feel it. The next words are close. You already know them. You have been saying them with your hands.');
    yield* Story.oath(2);
    yield* say('torvan', 'Well, that\'s going to take some getting used to. Grain\'s on its way home. East road\'s open: the Sundered Deep is next.');
    S.nodes.chasm = 1;
    setQuest('Go east, to the Sundered Deep', 'crags', 71, 14);
    Game.save();
  },
  *cragsExit() {
    if (!S.flags.hadrinDown) { yield* narr('Deserters hold the east road.'); Field.player.x -= 18; return; }
    setQuest('Enter the Sundered Deep', null);
    S.quest = 'Enter the Sundered Deep'; S.marker = ['chasm', 7, 4];
    yield* Game.toWorld('chasm');
  },
  // ---------- chasm ----------
  *chasmIntro() {
    yield* say('torvan', 'Stay close. And quiet. Whatever cut these chasms is long gone, but what lives here now is big.');
    yield* say('issa', 'The survey shows a sealed gate to the east. It is powered by three old lamps, one in each branch. They are dead now. They will need someone to breathe Stormlight into them.');
    yield* say('spren', 'That would be you. Press OK at each lamp.');
    S.quest = 'Light the three dead lamps (0/3)'; S.marker = ['chasm', 40, 20];
  },
  *lamp(o) {
    const fl = o.lamp;
    if (S.flags[fl]) { yield* narr('The lamp burns steadily.'); return; }
    S.flags[fl] = 1; o.kind = 'lampLit'; Sfx.play('surge');
    Particles.burst(o.x, o.y - 18, 26, ORDER(S.party[0].order).color, { s1: 80 });
    const n = ['L1', 'L2', 'L3'].filter(k => S.flags[k]).length;
    yield* narr(`You breathe out, and Stormlight curls into the old lamp. ${n}/3 lit.`);
    if (n === 3) {
      S.flags.chasmGate = 1;
      Sfx.play('bigfx'); Field.shake = .6;
      yield* say('issa', 'There! I heard the gate release, far to the east. Beautiful work. Terrible plumbing, but beautiful.');
      S.quest = 'Pass the opened gate and head north'; S.marker = ['chasm', 52, 13];
    } else {
      const next = !S.flags.L2 ? [13, 39] : [44, 40];
      S.quest = `Light the three dead lamps (${n}/3)`; S.marker = ['chasm', next[0], next[1]];
    }
  },
  *fiendSceneStart() {
    Field.lock();
    Sfx.play('thunder');
    Field.shake = 1;
    yield* say('torvan', 'Hear that? That hum in the rock? Oh, no. No, no, no. That\'s the thrum. Get behind me. Get behind something!');
    yield* narr('The chasm wall ahead unfolds. What you took for stone has legs, and a mouth full of swords. A chasmfiend, grown fat on a thousand years of nothing to fear.');
    const r = yield* Battle.run(['chasmfiend'], { noFlee: true, back: 'chasm' });
    if (r === 'lose') return;
    S.flags.fiendScene = 1;
    Sfx.play('thunder'); Field.shake = 1.5;
    yield* narr('The great beast falls, and the wall falls with it. Stone slams down in a roar of dust.');
    yield* say('issa', 'Torvan! Torvan is under there! I cannot, I don\'t have anything that can...');
    yield* say('torvan', 'Go. Go on. The gate. Four thousand people. Don\'t you stormin\' dare stop for one bridgeman.');
    yield* say('spren', 'You need more than you have. Say what you came here to say. Then reach out your hand, and I will be there. In ten heartbeats. That is how it has always been.');
    yield* Story.oath(3);
    const o = ORDER(S.party[0].order);
    yield* narr(`Ten heartbeats. Mist gathers in your palm, and ${o.spren} falls into your grip as a long blade of light. It goes through the fallen stone as if it were smoke.`);
    S.flags.fiendScene = 0;
    delete S.flags.fiendScene;
    yield* say('torvan', 'Hah... ow. That is a Shardblade. That is a storming Shardblade. It was your spren, wasn\'t it? And I\'ve been telling it jokes.');
    yield* say('spren', 'They were bad jokes. Yes. Now you know why the old Radiants were so afraid to break their oaths. Keep me in your hand, {name}.');
    S.nodes.vault = 1;
    setQuest('Go north out of the chasm, to the Vault of Oaths', 'chasm', 49, 0);
    Game.save();
  },
  *chasmExit() {
    if (!S.nodes.vault) { yield* narr('The way out lies beyond the beast. Better not.'); Field.player.y += 18; return; }
    S.quest = 'Open the Vault of Oaths'; S.marker = ['vault', 23, 36];
    yield* Game.toWorld('vault');
  },
  // ---------- vault ----------
  puzzleOrder() { const i = ORDERS.findIndex(o => o.id === S.party[0].order); return [0, 1, 2, 3].map(k => ORDERS[(i + k) % 10]); },
  plateLayout() { const p = this.puzzleOrder(); return [p[2], p[0], p[3], p[1]]; },
  *vaultIntro() {
    yield* say('issa', 'Oh. Oh, look at it. Nobody has walked here in over two thousand years. Be respectful. Touch nothing. I will touch everything.');
    yield* say('spren', 'The door is sealed by four floor plates. There is a mural on the wall to the left. Read it, then step on the plates in the right order.');
    S.quest = 'Read the mural, then solve the plates'; S.marker = ['vault', 17, 27];
  },
  *mural() {
    const p = this.puzzleOrder(), L = this.plateLayout();
    yield* narr('Ten Orders in a ring, each sharing a Surge with the next. Oaths pass hand to hand around the circle. Begin with yourself, and pass it on.');
    yield* narr(`The plates, left to right, bear the glyphs of the ${L.map(o => o.name).join(', ')}.`);
    yield* narr('Each Order\'s Surges: ' + p.slice().sort((a, b) => a.name.localeCompare(b.name)).map(o => `${o.name.slice(0, -1)}: ${o.surges.map(s => SURGES[s].name).join('+')}`).join('. ') + '.');
    S.quest = 'Step on the plates: begin with your own Order, then follow the shared Surges'; S.marker = null; S.flags.muralRead = 1;
  },
  plateStep(i) {
    const L = this.plateLayout(), p = this.puzzleOrder();
    if (S.flags.vaultDoor) return;
    const want = p[S.plateN || 0];
    if (L[i].id === want.id) {
      S.plateN = (S.plateN || 0) + 1; Sfx.play('seal');
      Field.toast(`The ${L[i].name} glyph answers. (${S.plateN}/4)`);
      if (S.plateN === 4) {
        S.flags.vaultDoor = 1; Sfx.play('bigfx'); Field.shake = 1;
        Game.run(Story.vaultOpen());
      }
    } else if (S.plateN) { S.plateN = 0; Sfx.play('denied'); Field.toast('The glyphs flicker out. Begin again, with your own Order.'); }
    else { Sfx.play('denied'); Field.toast(`The ${L[i].name} glyph stays dark. Begin with your own Order.`); }
  },
  *vaultOpen() {
    yield* say('issa', 'It\'s open! All that, and it\'s just a lovely, lovely door. Forward! The dais must be in the great hall!');
    S.quest = 'Enter the great hall'; S.marker = ['vault', 23, 16];
  },
  *cantorScene() {
    Field.lock();
    yield* narr('Ten stone Radiants look down upon the hall. Between them, a tall figure in shredded ashen robes hangs a hand above the floor, humming. The ground beneath it hums back.');
    yield* say('cantor', 'Ah. They finally send one. I have sung your kind to death on nine Desolations, little Radiant. I sang to this place when it was new.');
    yield* say('cantor', 'This gate will open for the Everstorm. Think of it: all the red lightning of Odium, loosed in the heart of your tower. All I need is someone who has sworn, to wake it for me.');
    yield* say('torvan', 'A Fused. That\'s a storming Fused. They don\'t die, you can only make them leave.');
    yield* say('cantor', 'Come closer. Sing with me.');
    const r = yield* Battle.run(['cantor'], { noFlee: true, back: 'vault' });
    if (r === 'lose') return;
    S.flags.cantorDown = 1;
    yield* narr('The Cantor crumples, laughing, and its laugh turns into a rhythm. Your Stormlight, your blows, every word you spoke here: it was all sung into the floor. The dais drinks it in.');
    yield* say('cantor', 'Thank you. It needed only a Radiant\'s Light. Now I will go ahead, and wake it from the other side.');
    Sfx.play('bigfx'); Field.shake = 2;
    yield* say('issa', 'The floor! It is opening a Perpendicularity! We are falling, we are all...');
    Game.flashCol = '#ffffff'; Game.flashA = 1;
    yield* Game.fadeOut(.6);
    Game.enterMap('shadesmar', 3, 18);
    S.quest = 'Find a way back from Shadesmar'; S.marker = ['shadesmar', 24, 13];
    Game.scene = FieldScene;
    yield* Game.fadeIn(.8);
  },
  // ---------- shadesmar ----------
  *shadesmarIntro() {
    yield* narr('You lie on a shore of hard black glass. Above, a white sun hangs still in a black sky. Where the ocean ought to be there is a sea of glass beads, each one the soul of a thing in the world you left.');
    const o = ORDER(S.party[0].order);
    yield* say('spren', 'Shadesmar. The Cognitive Realm. My home. Look at me: this is how I actually am. Do not stare.');
    yield* say('issa', 'I have spent my whole life reading about this. I would like to sit down now, please. Do we have a way out?');
    yield* say('spren', 'There is an enclave ahead, of spren who still keep faith. They will know where the Cantor crossed. ' + (o.id === 'lightweaver' ? 'Mmm. Also, try not to stare at the beads. They look back.' : 'Try not to stare into the beads for long.'));
  },
  *sprenElder() {
    if (!S.flags.deadeyeSeen) {
      yield* say('sprenElder', 'A sworn human. In my enclave. Two thousand years, and you come strolling in, with your oaths in your mouth like there had never been a betrayal.');
      yield* say('sprenElder', 'Your Fused has crossed east, past the field of the Deadeyes, and left a hunter at the rift. It wants your Light. Go if you must. But first walk through that field. See what your people did to mine.');
      S.quest = 'Cross the field of Deadeyes'; S.marker = ['shadesmar', 40, 10];
    } else yield* say('sprenElder', 'I see. You went and you looked. Perhaps that is more than anyone has done. Go on. Hold your words tightly, sworn one.');
  },
  *deadeyeScene() {
    Field.lock();
    Music.play('oath');
    yield* narr('They stand on the black glass in rows. Hundreds of them. Tall, thin, and pale, their eyes scratched out, staring at nothing. They do not turn when you pass. They do not turn for anything.');
    yield* say('spren', 'These are Deadeyes. This is what happens to a spren when its Radiant breaks the oath. We called it the Recreance. You read that it was a day of treason. To them it was the last day of everything.');
    yield* say('torvan', 'Stormfather. All of these? And they know we\'re here?');
    yield* say('spren', 'Some part of them does. I knew that one. She used to sing.');
    yield* narr('You stand a long time in front of the one your spren pointed out. You think about how much easier it would be to say nothing. Then you think about how easy it was, for all of them, once.');
    yield* say('spren', 'If you ever break your words, I will stand here too. I need you to know that. I need you to say it anyway. Not because you are sure, but because you are not.');
    yield* Story.oath(4);
    yield* narr('Light knits itself into armor across your shoulders. Spren you have never met drift in from the sea of beads to be part of it. Living Shardplate. It is warm, and it weighs nothing at all.');
    Music.play('shadesmar');
    S.quest = 'Reach the rift to the east'; S.marker = ['shadesmar', 54, 18];
    Game.save();
  },
  *hunterScene() {
    if (!S.flags.deadeyeSeen) { yield* narr('The elder said you must walk through the Deadeyes first.'); Field.player.x -= 24; delete S.flags.hunterSeen; return; }
    Field.lock();
    yield* narr('A shape of black glass unfolds from the sea of beads and rises to stand before the rift. It wears a spear of night and the faces of a hundred lost spren.');
    yield* say('issa', 'That thing is built like Shadesmar itself. Beads and glass. It will shatter if you hit it with something heavy.');
    const r = yield* Battle.run(['hunter'], { noFlee: true, back: 'shadesmar' });
    if (r === 'lose') return;
    S.flags.hunterDown = 1;
    yield* narr('It breaks apart in a long clatter of beads. Behind it, the rift burns red: an open wound, full of wind.');
    S.quest = 'Step through the rift'; S.marker = ['shadesmar', 60, 18];
    Game.save();
  },
  *rift() {
    if (!S.flags.hunterDown) { yield* narr('The rift hisses. Something stands guard over it.'); return; }
    const c = yield* Dialog.choice('The rift leads to the Oathgate, and the Everstorm. Ready?', ['Go through', 'Not yet']);
    if (c !== 0) return;
    Sfx.play('bigfx');
    yield* Game.fadeOut(.6);
    Game.enterMap('dais', 15, 20);
    S.quest = 'Stop the Cantor at the Oathgate'; S.marker = ['dais', 15, 15];
    Game.scene = FieldScene;
    yield* Game.fadeIn(.8);
    yield* narr('You step out onto the roof of the Vault. The Everstorm is a black wall on the western sky, shot through with red. Below you, a line of torches: four thousand people are coming up the mountain road.');
    Game.save();
  },
  // ---------- finale ----------
  *finale() {
    Field.lock();
    yield* say('cantor', 'You came back! Oh, well sung. And look, you have brought an audience. Let them come. They will have a very good view.');
    yield* say('cantor', 'I have sat beside this gate for three thousand years, waiting for someone to wake it. Now, rise and greet them.');
    Sfx.play('thunder'); Field.shake = 2.2;
    yield* narr('The mountainside tears open. A thing of living stone heaves itself up over the edge of the dais, each of its steps a small earthquake: a thunderclast, its chest cracked and full of red light.');
    yield* say('torvan', 'Oh, come on.');
    let r = yield* Battle.run(['thunderclast'], { noFlee: true, back: 'everstorm' });
    if (r === 'lose') return;
    Sfx.play('thunder'); Field.shake = 2;
    yield* narr('The thunderclast crashes down the mountainside and takes the far road with it. On the near road, the first of the refugees reach the top. They stop, staring.');
    if (S.flags.hadrinSpared) {
      yield* say('hadrin', 'Keep moving! Spears up, you lot, form on the road! Sergeant! I brought your grain and four hundred men, and I\'m told there\'s a war on!');
      yield* say('torvan', 'Hadrin, you magnificent thief! Hold that line!');
    } else yield* say('elder', 'Keep them moving! Everyone with a spear, to the road! We hold here until the last child is through!');
    yield* say('issa', 'I can wake the dais! I need time, and I need the Light! Keep that thing away from me!');
    yield* say('cantor', 'Then let us finish the verse.');
    for (const h of S.party) { const st = stats(h, S.ideal); h.hp = st.hp; h.sl = st.sl; }
    r = yield* Battle.run(['cantor2'], { noFlee: true, back: 'everstorm', res: 100 });
    if (r === 'lose') return;
    S.flags.finalDown = 1;
    yield* narr('The Cantor\'s song breaks. It laughs, in a rhythm you cannot quite follow, and comes apart into ash and red wind. It will return. They always return. It will not be today.');
    yield* say('issa', 'It needs Light! More than I have! Spheres, everything, give me all of it!');
    yield* narr('You put your hand down on the dais and breathe out. All of it. Everything you have. The ten glyphs light one by one, then all at once.');
    Sfx.play('oath'); Game.flashCol = ORDER(S.party[0].order).color; Game.flashA = 1;
    yield* wait(.5);
    yield* say('spren', 'There. Do you see? Ten Orders walked away from this place. You came back alone, and it was enough to open a door.');
    yield* Game.fadeOut(1.2);
    yield* Story.ending();
  },
  *ending() {
    const o = ORDER(S.party[0].order);
    Game.scene = CineScene; CineScene.back = 'urithiru'; Weather.set('none'); Music.play('oath');
    yield* Game.fadeIn(1.4);
    yield* CineScene.caption(['They crossed all that night, a thousand at a time.', 'They stepped onto a dais in a dying valley, and stepped off in a cold bright air, at the foot of a tower that had waited for them for two thousand years.']);
    yield* CineScene.caption(['Pell was the first child through. He has not stopped talking about it.', S.flags.hadrinSpared ? 'Captain Hadrin stood his line until the last torch had passed, and then he went through last, with four hundred men. He stood trial in Urithiru and received a very long sentence: he must guard its gates.' : 'Highmarshal Dorvan went through last, carrying the town\'s charts under his arm. He has already started new ones.']);
    yield* CineScene.caption([`${S.party[0].name} of the ${o.name}, who had been no one, stood on the high balcony with a sergeant, a Thaylen, and a spren. And somewhere under the world, in a field of black glass, one Deadeye had turned, very slightly, toward the light.`]);
    yield* CineScene.caption(['There are more Ideals to speak. There always are.', 'Journey before destination.']);
    yield* Game.fadeOut(1);
    Game.ended = true;
    Game.scene = EndScene; EndScene.t = 0; Music.play('title');
    yield* Game.fadeIn(.8);
    yield* wait(1.2);
    while (!Input.pressed.ok) yield;
    yield* Game.fadeOut(.6);
    Game.toTitle();
  }
};
