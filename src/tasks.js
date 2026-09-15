// Gizli görev havuzu.
// verify: 'oto'      → sunucu otomatik takip eder
//         'yayinci'  → oyun sahibi onaylar
//         'koy'      → oyun sonunda köy oylar

export const VERIFY = { AUTO: 'oto', HOST: 'yayinci', VILLAGE: 'koy' };

export const TASKS = [
  // ── A. Konuşma tarzı ──
  { id: 1, text: 'Bir gün boyunca en az 5 kere İngilizce cümle kur.', verify: VERIFY.VILLAGE, points: 1 },
  { id: 2, text: 'Bir tur boyunca sadece soru sorarak konuş.', verify: VERIFY.VILLAGE, points: 2 },
  { id: 3, text: 'Kendinden hep üçüncü tekil şahısla bahset. "Emre öyle düşünmüyor."', verify: VERIFY.VILLAGE, points: 2 },
  { id: 4, text: 'Bir gün boyunca fısıltıyla konuş.', verify: VERIFY.VILLAGE, points: 1 },
  { id: 5, text: 'Her cümlene "bak şimdi" diye başla.', verify: VERIFY.VILLAGE, points: 1 },
  { id: 6, text: 'Bir tur boyunca hiç "ben" deme.', verify: VERIFY.VILLAGE, points: 2 },
  { id: 7, text: 'Herkese "siz" diye hitap et, aşırı resmi konuş.', verify: VERIFY.VILLAGE, points: 1 },
  { id: 8, text: 'Her cümleni "değil mi?" ile bitir.', verify: VERIFY.VILLAGE, points: 1 },
  { id: 9, text: 'Oyun boyunca hiç gülme, taş gibi ciddi kal.', verify: VERIFY.VILLAGE, points: 3 },
  { id: 10, text: 'Konuşmana 3 kere yabancı kelime sıkıştır. Almanca, İspanyolca, fark etmez.', verify: VERIFY.VILLAGE, points: 1 },
  { id: 11, text: 'Bir tur boyunca çok yavaş ve sakin konuş.', verify: VERIFY.VILLAGE, points: 1 },
  { id: 12, text: 'Bir tur boyunca sesini bir tık kalınlaştır.', verify: VERIFY.VILLAGE, points: 1 },
  { id: 13, text: 'Her konuşmanda kendi ismini en az bir kere geçir.', verify: VERIFY.VILLAGE, points: 1 },
  { id: 14, text: 'Bir tur boyunca cümlelerini 5 kelimeyi geçmeden bitir.', verify: VERIFY.VILLAGE, points: 2 },
  { id: 15, text: 'Maç spikeri gibi konuş, olan biteni anlat.', verify: VERIFY.VILLAGE, points: 2 },
  { id: 16, text: 'Her cümlene bir küfür ekle.', verify: VERIFY.VILLAGE, points: 1, optional: true },
  { id: 17, text: 'Bir kere kafiyeli, şiir gibi konuş.', verify: VERIFY.VILLAGE, points: 2 },
  { id: 18, text: 'Kimseyi ismiyle çağırma, sadece sıra numarasıyla hitap et.', verify: VERIFY.VILLAGE, points: 2 },
  { id: 19, text: 'Konuşmaya başlamadan önce hep boğazını temizle.', verify: VERIFY.VILLAGE, points: 1 },

  // ── B. Kelime görevleri ──
  { id: 20, text: '"Domates" kelimesini doğal görünecek şekilde konuşmana sok.', verify: VERIFY.VILLAGE, points: 1 },
  { id: 21, text: '"Kesinlikle" kelimesini 5 kere kullan.', verify: VERIFY.VILLAGE, points: 1 },
  { id: 22, text: 'Bir cümlede 3 atasözünü arka arkaya sırala.', verify: VERIFY.VILLAGE, points: 2 },
  { id: 23, text: '"Abi" veya "ablacım" kelimesini 10 kere kullan.', verify: VERIFY.VILLAGE, points: 1 },
  { id: 24, text: 'Bir tur boyunca "evet" ve "hayır" deme.', verify: VERIFY.VILLAGE, points: 2 },
  { id: 25, text: 'Bir film repliğini kendi cümlenmiş gibi söyle.', verify: VERIFY.VILLAGE, points: 2 },
  { id: 26, text: '"Ben köylüyüm" cümlesini hiç kurmadan köylü olduğuna ikna et.', verify: VERIFY.VILLAGE, points: 2 },
  { id: 27, text: 'Bir reklam sloganını konuşmana yerleştir.', verify: VERIFY.VILLAGE, points: 1 },
  { id: 28, text: 'Her turda farklı bir hayvan ismi geçir.', verify: VERIFY.VILLAGE, points: 2 },
  { id: 29, text: 'Sıran geldiğinde bir kere sadece "pas" de, başka hiçbir şey söyleme.', verify: VERIFY.VILLAGE, points: 1 },
  { id: 30, text: 'Bir kişinin ismini konuşmanda 5 kere söyle, göze batmadan.', verify: VERIFY.VILLAGE, points: 2 },

  // ── C. Oyun içi taktik ──
  {
    id: 31,
    text: '{hedef} oyuncusunu astır.',
    verify: VERIFY.AUTO,
    auto: 'lynchTarget',
    needsTarget: true,
    points: 3,
  },
  { id: 32, text: 'Gün 3\'e kadar hayatta kal.', verify: VERIFY.AUTO, auto: 'surviveDay3', points: 2 },
  { id: 33, text: 'Bir turda 3 farklı kişiyi şüpheli göster.', verify: VERIFY.VILLAGE, points: 2 },
  { id: 34, text: 'Doktor olduğunu iddia et, değilsen bile.', verify: VERIFY.VILLAGE, points: 2 },
  { id: 35, text: 'Gün 1\'de hiç konuşma, sadece dinle.', verify: VERIFY.VILLAGE, points: 1 },
  { id: 36, text: 'Oyunu şiirle gerekçelendir.', verify: VERIFY.VILLAGE, points: 2 },

  // ── D. Performans ──
  { id: 37, text: 'Birine şarkı söylet.', verify: VERIFY.HOST, points: 3 },
  { id: 38, text: 'Bir kişiye taklit yaptır.', verify: VERIFY.HOST, points: 3 },
  { id: 39, text: 'Sesli olarak 10\'dan geriye say.', verify: VERIFY.HOST, points: 1 },
  { id: 40, text: 'Bir reklam jingle\'ı söyle.', verify: VERIFY.HOST, points: 2 },
  { id: 41, text: 'Bir kişiye senin kurduğun cümleyi aynen tekrarlat.', verify: VERIFY.HOST, points: 3 },
  { id: 42, text: 'Rolünü ima eden bir bilmece sor.', verify: VERIFY.HOST, points: 2 },
];

export const TASK_BY_ID = new Map(TASKS.map((t) => [t.id, t]));

export const VERIFY_LABEL = {
  [VERIFY.AUTO]: 'Oyun takip ediyor',
  [VERIFY.HOST]: 'Oyun sahibi onaylar',
  [VERIFY.VILLAGE]: 'Köy oylar',
};
