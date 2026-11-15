/*
 * 写字岛 — 单词和句子
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

  var zh = {};
  WORDS.concat(SENTS).forEach(function (g) { g.items.forEach(function (it) { zh[it[0]] = it[1]; }); });

  function wordCount(text) { return text.split(' ').length; }
  function letterCount(text) { return text.replace(/ /g, '').length; }

  root.WI = root.WI || {};
  root.WI.Words = { WORDS: WORDS, SENTS: SENTS, zh: zh, wordCount: wordCount, letterCount: letterCount };
})(typeof window !== 'undefined' ? window : globalThis);
