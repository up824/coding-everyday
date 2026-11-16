/*
 * 写字岛 — 单词、句子、多位数和算式
 *
 * 每一项是 [英文, 中文意思]。句子按单词数从少到多排：两个词 → 十二个词 → 连成一小段话。
 * 只能用字母、数字、空格和 . , ? ! ' 这几个标点（笔画数据里有的字符）。
 */
(function (root) {
  'use strict';

  var WORDS = [
    { title: '你我他', items: [['I', '我'], ['you', '你'], ['he', '他'], ['she', '她'], ['we', '我们']] },
    { title: '是不是', items: [['am', '（我）是'], ['is', '（他、她）是'], ['are', '（你、我们）是'], ['yes', '是的'], ['no', '不']] },
    { title: '小小词', items: [['a', '一个'], ['the', '这个'], ['and', '和'], ['my', '我的'], ['it', '它']] },
    { title: '动一动', items: [['go', '去'], ['see', '看见'], ['like', '喜欢'], ['have', '有'], ['play', '玩']] },
    { title: '一家人', items: [['mom', '妈妈'], ['dad', '爸爸'], ['baby', '宝宝'], ['boy', '男孩'], ['girl', '女孩']] },
    { title: '小动物', items: [['cat', '猫'], ['dog', '狗'], ['bird', '鸟'], ['fish', '鱼'], ['duck', '鸭子']] },
    { title: '颜色', items: [['red', '红色'], ['blue', '蓝色'], ['green', '绿色'], ['pink', '粉色'], ['yellow', '黄色']] },
    { title: '好吃的', items: [['apple', '苹果'], ['milk', '牛奶'], ['egg', '鸡蛋'], ['cake', '蛋糕'], ['rice', '米饭']] },
    { title: '上学去', items: [['book', '书'], ['pen', '钢笔'], ['bag', '书包'], ['desk', '书桌'], ['school', '学校']] },
    { title: '数一数', items: [['one', '一'], ['two', '二'], ['three', '三'], ['four', '四'], ['five', '五']] },
    { title: '打招呼', items: [['hello', '你好'], ['hi', '嗨'], ['bye', '再见'], ['please', '请'], ['thanks', '谢谢']] },
    { title: '常用词', items: [['this', '这个'], ['that', '那个'], ['can', '能'], ['in', '在…里面'], ['on', '在…上面']] },
    { title: '什么样', items: [['big', '大的'], ['small', '小的'], ['good', '好的'], ['happy', '开心的'], ['new', '新的']] }
  ];

  var SENTS = [
    { title: '两个词', items: [['Thank you.', '谢谢你。'], ['Good morning.', '早上好。'], ["Let's go!", '我们走吧！'], ['Good job!', '做得好！']] },
    { title: '三个词', items: [['I am happy.', '我很开心。'], ['I like cats.', '我喜欢猫。'], ['Yes, I can.', '是的，我可以。'], ['How are you?', '你好吗？']] },
    { title: '四个词', items: [['This is my mom.', '这是我妈妈。'], ['I have a dog.', '我有一只狗。'], ['What is your name?', '你叫什么名字？']] },
    { title: '五个词', items: [['I can see a bird.', '我能看见一只鸟。'], ['My bag is very big.', '我的书包很大。'], ['I like to read books.', '我喜欢看书。']] },
    { title: '六个词', items: [['I go to school by bus.', '我坐公交车去上学。'], ['My dog likes to play ball.', '我的狗喜欢玩球。'], ['We have a new red kite.', '我们有一只新的红风筝。']] },
    { title: '七八个词', items: [['I like to read books with my mom.', '我喜欢和妈妈一起看书。'], ['There is a big tree in the park.', '公园里有一棵大树。'], ['We play football after school on Friday.', '星期五放学后我们踢足球。']] },
    { title: '九十个词', items: [['My name is Amy and I am seven years old.', '我叫艾米，今年七岁。'], ['I get up at seven and go to school.', '我七点起床，然后去上学。'], ['My dad and I like to play in the park.', '我和爸爸喜欢在公园里玩。']] },
    { title: '十二个词', items: [['On Sunday I go to the park with my mom and dad.', '星期天我和爸爸妈妈去公园。'], ['After school I do my homework and then play with my dog.', '放学后我先做作业，然后和我的狗玩。'], ['I like my school because my teachers and friends are very nice.', '我喜欢我的学校，因为老师和朋友们都很好。']] },
    // 最后两关：把几句话连起来，自己写出一小段
    { title: '一段话：介绍自己', para: true, items: [['My name is Amy.', '我叫艾米。'], ['I am seven years old.', '我七岁了。'], ['I have a small dog.', '我有一只小狗。'], ['I like to play with my dog after school.', '放学后我喜欢和我的狗一起玩。']] },
    { title: '一段话：我的一天', para: true, items: [['I get up at seven.', '我七点起床。'], ['I go to school with my friends.', '我和朋友们一起去上学。'], ['After school I read books and play football.', '放学后我看书、踢足球。'], ['I go to bed at nine.', '我九点睡觉。']] }
  ];

  /* ---------- 多位数和算式 ----------
     只写式子本身，中文读法（三加五等于八）由下面的函数算出来。减号用键盘上的 -，乘除用 × ÷。 */
  var MATH_SRC = [
    { title: '两位数', items: ['10', '25', '48', '60', '99'] },
    { title: '几百', items: ['100', '256', '380', '705', '999'] },
    { title: '几千', items: ['1000', '2048', '3650', '5007', '9999'] },
    { title: '运算符号', items: ['+', '-', '×', '÷', '='] },
    { title: '加法', items: ['3 + 5 = 8', '12 + 7 = 19', '25 + 30 = 55', '140 + 60 = 200'] },
    { title: '减法', items: ['9 - 4 = 5', '15 - 8 = 7', '60 - 25 = 35', '500 - 120 = 380'] },
    { title: '乘法', items: ['2 × 3 = 6', '6 × 7 = 42', '12 × 4 = 48', '25 × 4 = 100'] },
    { title: '除法', items: ['8 ÷ 2 = 4', '24 ÷ 6 = 4', '81 ÷ 9 = 9', '100 ÷ 5 = 20'] },
    { title: '大数算式', items: ['125 + 375 = 500', '1000 - 250 = 750', '300 × 3 = 900', '2400 ÷ 6 = 400'] }
  ];

  var ZD = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'], ZU = ['', '十', '百', '千'];
  function numZh(n) {
    var str = String(n), out = '', gap = false;
    if (n === 0) return ZD[0];
    for (var i = 0; i < str.length; i++) {
      var c = +str[i];
      if (c === 0) { gap = true; continue; }
      if (gap && out) out += ZD[0];              // 中间有 0：七百零五
      gap = false;
      out += ZD[c] + ZU[str.length - 1 - i];
    }
    return n >= 10 && n < 20 ? out.replace(/^一十/, '十') : out;
  }
  var E1 = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
    'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  var E10 = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  function numEn(n) {
    if (n < 20) return E1[n];
    if (n < 100) return E10[Math.floor(n / 10)] + (n % 10 ? '-' + E1[n % 10] : '');
    if (n < 1000) return E1[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + numEn(n % 100) : '');
    return numEn(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + numEn(n % 1000) : '');
  }
  var OP_ZH = { '+': '加', '-': '减', '×': '乘', '÷': '除以', '=': '等于' };
  var OP_EN = { '+': 'plus', '-': 'minus', '×': 'times', '÷': 'divided by', '=': 'equals' };
  var SIGN_ZH = { '+': '加号', '-': '减号', '×': '乘号', '÷': '除号', '=': '等号' };
  var SIGN_EN = { '+': 'plus sign', '-': 'minus sign', '×': 'times sign', '÷': 'division sign', '=': 'equals sign' };
  function isMath(text) { return /^[0-9+\-×÷= ]+$/.test(text); }
  function readMath(text, en) {
    if (text.length === 1 && OP_ZH[text]) return en ? SIGN_EN[text] : SIGN_ZH[text];
    return text.split(' ').map(function (tok) {
      if (/^[0-9]+$/.test(tok)) return en ? numEn(+tok) : numZh(+tok);
      return en ? OP_EN[tok] : OP_ZH[tok];
    }).join(en ? ' ' : '');
  }
  var MATH = MATH_SRC.map(function (g) {
    return { title: g.title, items: g.items.map(function (t) { return [t, readMath(t, false)]; }) };
  });

  var zh = {};
  WORDS.concat(SENTS, MATH).forEach(function (g) { g.items.forEach(function (it) { zh[it[0]] = it[1]; }); });

  function wordCount(text) { return text.split(' ').length; }
  function letterCount(text) { return text.replace(/ /g, '').length; }

  root.WI = root.WI || {};
  root.WI.Words = {
    WORDS: WORDS, SENTS: SENTS, MATH: MATH, zh: zh, wordCount: wordCount, letterCount: letterCount,
    isMath: isMath, readMath: readMath, numZh: numZh, numEn: numEn
  };
})(typeof window !== 'undefined' ? window : globalThis);
