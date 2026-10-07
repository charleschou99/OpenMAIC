#!/usr/bin/env npx tsx
/**
 * Generate curriculum skeleton for all grades and subjects
 * 
 * Creates directory structure and manifest files with:
 * - Real unit titles where known from official textbooks
 * - TODO placeholders where titles need research
 * - Correct textbook edition labels per subject
 */

import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

const GRADES = [
  { level: 1, nameZh: '一年级', name: 'Grade 1', ageMin: 6, ageMax: 7 },
  { level: 2, nameZh: '二年级', name: 'Grade 2', ageMin: 7, ageMax: 8 },
  { level: 3, nameZh: '三年级', name: 'Grade 3', ageMin: 8, ageMax: 9 },
  { level: 4, nameZh: '四年级', name: 'Grade 4', ageMin: 9, ageMax: 10 },
  { level: 5, nameZh: '五年级', name: 'Grade 5', ageMin: 10, ageMax: 11 },
  { level: 6, nameZh: '六年级', name: 'Grade 6', ageMin: 11, ageMax: 12 },
];

const SEMESTERS = [
  { id: '上学期', name: 'Fall Semester', suffix: '上册' },
  { id: '下学期', name: 'Spring Semester', suffix: '下册' },
];

// Subject definitions with correct textbook editions
const SUBJECTS = {
  语文: {
    id: 'chinese',
    name: 'Chinese Language',
    textbookEdition: {
      id: 'tongbian',
      nameZh: '统编版',
      publisher: '人民教育出版社',
    },
    curriculumStandard: {
      year: 2022,
      name: '义务教育语文课程标准（2022年版）',
    },
    lessonsPerWeek: 8,
    gradesAvailable: [1, 2, 3, 4, 5, 6],
  },
  数学: {
    id: 'math',
    name: 'Mathematics',
    textbookEdition: {
      id: 'pep',
      nameZh: '人教版',
      publisher: '人民教育出版社',
    },
    curriculumStandard: {
      year: 2022,
      name: '义务教育数学课程标准（2022年版）',
    },
    lessonsPerWeek: 5,
    gradesAvailable: [1, 2, 3, 4, 5, 6],
  },
  英语: {
    id: 'english',
    name: 'English',
    textbookEdition: {
      id: 'pep-english',
      nameZh: '人教版 PEP',
      publisher: '人民教育出版社',
    },
    curriculumStandard: {
      year: 2022,
      name: '义务教育英语课程标准（2022年版）',
    },
    lessonsPerWeek: 3,
    gradesAvailable: [3, 4, 5, 6], // English starts in grade 3
  },
  道德与法治: {
    id: 'ethics',
    name: 'Moral Education and Rule of Law',
    textbookEdition: {
      id: 'tongbian',
      nameZh: '统编版',
      publisher: '人民教育出版社',
    },
    curriculumStandard: {
      year: 2022,
      name: '义务教育道德与法治课程标准（2022年版）',
    },
    lessonsPerWeek: 2,
    gradesAvailable: [1, 2, 3, 4, 5, 6],
  },
  科学: {
    id: 'science',
    name: 'Science',
    textbookEdition: {
      id: 'jiaoke',
      nameZh: '教科版',
      publisher: '教育科学出版社',
      note: '可配置其他版本：人教版、苏教版',
    },
    curriculumStandard: {
      year: 2022,
      name: '义务教育科学课程标准（2022年版）',
    },
    lessonsPerWeek: 2,
    gradesAvailable: [1, 2, 3, 4, 5, 6],
  },
};

// Real unit titles from official textbooks (where confidently known)
// Format: { [gradeLevel]: { [semester]: { [subjectZh]: string[] } } }
const KNOWN_UNITS: Record<number, Record<string, Record<string, { title: string; titleZh: string }[]>>> = {
  1: {
    '上学期': {
      '数学': [
        { title: 'Preparation', titleZh: '准备课' },
        { title: 'Position', titleZh: '位置' },
        { title: 'Numbers 1-5 and Operations', titleZh: '1-5的认识和加减法' },
        { title: 'Recognizing Shapes (1)', titleZh: '认识图形（一）' },
        { title: 'Numbers 6-10 and Operations', titleZh: '6-10的认识和加减法' },
        { title: 'Numbers 11-20', titleZh: '11-20各数的认识' },
        { title: 'Telling Time', titleZh: '认识钟表' },
        { title: 'Addition within 20', titleZh: '20以内的进位加法' },
      ],
      '语文': [
        { title: 'I Go to School', titleZh: '我上学了' },
        { title: 'Literacy 1', titleZh: '识字（一）' },
        { title: 'Chinese Pinyin', titleZh: '汉语拼音' },
        { title: 'Literacy 2', titleZh: '识字（二）' },
        { title: 'Texts 1', titleZh: '课文（一）' },
        { title: 'Texts 2', titleZh: '课文（二）' },
        { title: 'Texts 3', titleZh: '课文（三）' },
        { title: 'Texts 4', titleZh: '课文（四）' },
      ],
      '道德与法治': [
        { title: 'I Am a Primary Student', titleZh: '我是小学生啦' },
        { title: 'Campus Life Begins', titleZh: '校园生活真快乐' },
        { title: 'Home Sweet Home', titleZh: '家中的安全与健康' },
        { title: 'Happy New Year', titleZh: '天气虽冷有温暖' },
      ],
      '科学': [
        { title: 'Plants', titleZh: '植物' },
        { title: 'Comparing and Measuring', titleZh: '比较与测量' },
      ],
    },
    '下学期': {
      '数学': [
        { title: 'Recognizing Shapes (2)', titleZh: '认识图形（二）' },
        { title: 'Subtraction within 20', titleZh: '20以内的退位减法' },
        { title: 'Sorting and Organizing', titleZh: '分类与整理' },
        { title: 'Numbers within 100 (1)', titleZh: '100以内数的认识' },
        { title: 'RMB', titleZh: '认识人民币' },
        { title: 'Addition and Subtraction within 100 (1)', titleZh: '100以内的加法和减法（一）' },
        { title: 'Finding Patterns', titleZh: '找规律' },
      ],
      '语文': [
        { title: 'Literacy 1', titleZh: '识字（一）' },
        { title: 'Literacy 2', titleZh: '识字（二）' },
        { title: 'Texts 1', titleZh: '课文（一）' },
        { title: 'Texts 2', titleZh: '课文（二）' },
        { title: 'Texts 3', titleZh: '课文（三）' },
        { title: 'Texts 4', titleZh: '课文（四）' },
        { title: 'Literacy 3', titleZh: '识字（三）' },
        { title: 'Literacy 4', titleZh: '识字（四）' },
      ],
      '道德与法治': [
        { title: 'My Good Habits', titleZh: '我的好习惯' },
        { title: 'I Love My Family', titleZh: '我和我的家' },
        { title: 'We Love Each Other', titleZh: '我们在一起' },
        { title: 'Happy Summer', titleZh: '我们的夏天' },
      ],
      '科学': [
        { title: 'Our Senses', titleZh: '我们的感官' },
        { title: 'Animals', titleZh: '动物' },
      ],
    },
  },
  2: {
    '上学期': {
      '数学': [
        { title: 'Length Units', titleZh: '长度单位' },
        { title: 'Addition and Subtraction within 100 (2)', titleZh: '100以内的加法和减法（二）' },
        { title: 'Angles', titleZh: '角的初步认识' },
        { title: 'Multiplication Tables (1)', titleZh: '表内乘法（一）' },
        { title: 'Observing Objects (1)', titleZh: '观察物体（一）' },
        { title: 'Multiplication Tables (2)', titleZh: '表内乘法（二）' },
        { title: 'Understanding Time', titleZh: '认识时间' },
        { title: 'Math Problem Solving', titleZh: '数学广角——搭配（一）' },
      ],
      '语文': [
        { title: 'Texts 1', titleZh: '课文（一）' },
        { title: 'Literacy 1', titleZh: '识字（一）' },
        { title: 'Texts 2', titleZh: '课文（二）' },
        { title: 'Texts 3', titleZh: '课文（三）' },
        { title: 'Literacy 2', titleZh: '识字（二）' },
        { title: 'Texts 4', titleZh: '课文（四）' },
        { title: 'Texts 5', titleZh: '课文（五）' },
        { title: 'Texts 6', titleZh: '课文（六）' },
      ],
      '道德与法治': [
        { title: 'Holidays and Safety', titleZh: '我们的节假日' },
        { title: 'Our Class', titleZh: '我们的班级' },
        { title: 'Our Community', titleZh: '我们在公共场所' },
        { title: 'Our Home', titleZh: '我们生活的地方' },
      ],
      '科学': [
        { title: 'Our Earth Home', titleZh: '我们的地球家园' },
        { title: 'Materials', titleZh: '材料' },
      ],
    },
    '下学期': {
      '数学': [
        { title: 'Statistics', titleZh: '数据收集整理' },
        { title: 'Division Tables (1)', titleZh: '表内除法（一）' },
        { title: 'Patterns', titleZh: '图形的运动（一）' },
        { title: 'Division Tables (2)', titleZh: '表内除法（二）' },
        { title: 'Mixed Operations', titleZh: '混合运算' },
        { title: 'Remainder Division', titleZh: '有余数的除法' },
        { title: 'Large Numbers', titleZh: '万以内数的认识' },
        { title: 'Weight Units', titleZh: '克和千克' },
      ],
      '语文': [
        { title: 'Texts 1', titleZh: '课文（一）' },
        { title: 'Literacy 1', titleZh: '识字（一）' },
        { title: 'Texts 2', titleZh: '课文（二）' },
        { title: 'Literacy 2', titleZh: '识字（二）' },
        { title: 'Texts 3', titleZh: '课文（三）' },
        { title: 'Texts 4', titleZh: '课文（四）' },
        { title: 'Literacy 3', titleZh: '识字（三）' },
        { title: 'Texts 5', titleZh: '课文（五）' },
      ],
      '道德与法治': [
        { title: 'Let\'s Play', titleZh: '让我试试看' },
        { title: 'My Environmental Friends', titleZh: '我们好好玩' },
        { title: 'Green Life', titleZh: '绿色小卫士' },
        { title: 'Our Village', titleZh: '我会努力的' },
      ],
      '科学': [
        { title: 'Magnets', titleZh: '磁铁' },
        { title: 'Our Body', titleZh: '我们自己' },
      ],
    },
  },
  // Grades 3-6: Use TODO placeholders for units that need research
  3: {
    '上学期': {
      '数学': [
        { title: 'Time', titleZh: '时、分、秒' },
        { title: 'Large Numbers Addition/Subtraction', titleZh: '万以内的加法和减法（一）' },
        { title: 'Measurement', titleZh: '测量' },
        { title: 'Large Numbers Add/Sub (2)', titleZh: '万以内的加法和减法（二）' },
        { title: 'Times Tables', titleZh: '倍的认识' },
        { title: 'Multi-digit Multiplication', titleZh: '多位数乘一位数' },
        { title: 'Rectangles and Squares', titleZh: '长方形和正方形' },
        { title: 'Fractions Introduction', titleZh: '分数的初步认识' },
      ],
      '语文': [
        { title: 'TODO: Unit 1', titleZh: '【待补充】第一单元' },
        { title: 'TODO: Unit 2', titleZh: '【待补充】第二单元' },
        { title: 'TODO: Unit 3', titleZh: '【待补充】第三单元' },
        { title: 'TODO: Unit 4', titleZh: '【待补充】第四单元' },
        { title: 'TODO: Unit 5', titleZh: '【待补充】第五单元' },
        { title: 'TODO: Unit 6', titleZh: '【待补充】第六单元' },
        { title: 'TODO: Unit 7', titleZh: '【待补充】第七单元' },
        { title: 'TODO: Unit 8', titleZh: '【待补充】第八单元' },
      ],
      '英语': [
        { title: 'Hello!', titleZh: 'Hello!' },
        { title: 'Colours', titleZh: 'Colours' },
        { title: 'Look at me!', titleZh: 'Look at me!' },
        { title: 'We love animals', titleZh: 'We love animals' },
        { title: 'Let\'s eat!', titleZh: 'Let\'s eat!' },
        { title: 'Happy birthday!', titleZh: 'Happy birthday!' },
      ],
      '道德与法治': [
        { title: 'TODO: Unit 1', titleZh: '【待补充】第一单元' },
        { title: 'TODO: Unit 2', titleZh: '【待补充】第二单元' },
        { title: 'TODO: Unit 3', titleZh: '【待补充】第三单元' },
        { title: 'TODO: Unit 4', titleZh: '【待补充】第四单元' },
      ],
      '科学': [
        { title: 'Water', titleZh: '水' },
        { title: 'Air', titleZh: '空气' },
        { title: 'Weather', titleZh: '天气' },
      ],
    },
    '下学期': {
      '数学': [
        { title: 'Position and Direction (1)', titleZh: '位置与方向（一）' },
        { title: 'Division', titleZh: '除数是一位数的除法' },
        { title: 'Composite Stats', titleZh: '复式统计表' },
        { title: 'Two-digit Multiplication', titleZh: '两位数乘两位数' },
        { title: 'Area', titleZh: '面积' },
        { title: 'Year Month Day', titleZh: '年、月、日' },
        { title: 'Decimals Introduction', titleZh: '小数的初步认识' },
        { title: 'Math Problems', titleZh: '数学广角——搭配（二）' },
      ],
      '语文': [
        { title: 'TODO: Unit 1', titleZh: '【待补充】第一单元' },
        { title: 'TODO: Unit 2', titleZh: '【待补充】第二单元' },
        { title: 'TODO: Unit 3', titleZh: '【待补充】第三单元' },
        { title: 'TODO: Unit 4', titleZh: '【待补充】第四单元' },
        { title: 'TODO: Unit 5', titleZh: '【待补充】第五单元' },
        { title: 'TODO: Unit 6', titleZh: '【待补充】第六单元' },
        { title: 'TODO: Unit 7', titleZh: '【待补充】第七单元' },
        { title: 'TODO: Unit 8', titleZh: '【待补充】第八单元' },
      ],
      '英语': [
        { title: 'Welcome back to school!', titleZh: 'Welcome back to school!' },
        { title: 'My family', titleZh: 'My family' },
        { title: 'At the zoo', titleZh: 'At the zoo' },
        { title: 'Where is my car?', titleZh: 'Where is my car?' },
        { title: 'Do you like pears?', titleZh: 'Do you like pears?' },
        { title: 'How many?', titleZh: 'How many?' },
      ],
      '道德与法治': [
        { title: 'TODO: Unit 1', titleZh: '【待补充】第一单元' },
        { title: 'TODO: Unit 2', titleZh: '【待补充】第二单元' },
        { title: 'TODO: Unit 3', titleZh: '【待补充】第三单元' },
        { title: 'TODO: Unit 4', titleZh: '【待补充】第四单元' },
      ],
      '科学': [
        { title: 'Plants', titleZh: '植物的生长变化' },
        { title: 'Animals Life Cycle', titleZh: '动物的一生' },
        { title: 'Solar System', titleZh: '太阳、地球和月球' },
      ],
    },
  },
};

// For grades 4-6, generate TODO placeholders
function generateTodoUnits(count: number, subjectZh: string): { title: string; titleZh: string }[] {
  const units: { title: string; titleZh: string }[] = [];
  for (let i = 1; i <= count; i++) {
    units.push({
      title: `TODO: Unit ${i}`,
      titleZh: `【待补充】第${['一', '二', '三', '四', '五', '六', '七', '八'][i - 1] || i}单元`,
    });
  }
  return units;
}

// Fill in remaining grades with TODO placeholders
for (let grade = 4; grade <= 6; grade++) {
  KNOWN_UNITS[grade] = {
    '上学期': {
      '数学': generateTodoUnits(8, '数学'),
      '语文': generateTodoUnits(8, '语文'),
      '英语': generateTodoUnits(6, '英语'),
      '道德与法治': generateTodoUnits(4, '道德与法治'),
      '科学': generateTodoUnits(3, '科学'),
    },
    '下学期': {
      '数学': generateTodoUnits(8, '数学'),
      '语文': generateTodoUnits(8, '语文'),
      '英语': generateTodoUnits(6, '英语'),
      '道德与法治': generateTodoUnits(4, '道德与法治'),
      '科学': generateTodoUnits(3, '科学'),
    },
  };
}

function generateManifest(
  grade: typeof GRADES[0],
  semester: typeof SEMESTERS[0],
  subjectZh: string,
  subject: typeof SUBJECTS[keyof typeof SUBJECTS],
  units: { title: string; titleZh: string }[]
) {
  return {
    grade: {
      id: `grade-${grade.level}`,
      name: grade.name,
      nameZh: grade.nameZh,
      level: grade.level,
      ageRange: { min: grade.ageMin, max: grade.ageMax },
      semester: semester.id,
    },
    subject: {
      id: subject.id,
      name: subject.name,
      nameZh: subjectZh,
      textbookEdition: subject.textbookEdition,
      curriculumStandard: subject.curriculumStandard,
      sessionDurationMinutes: 40,
      lessonsPerWeek: subject.lessonsPerWeek,
      contentCharacteristics: {
        visualHeavy: true,
        voiceHeavy: true,
        minimalText: grade.level <= 2,
      },
    },
    units: units.map((unit, index) => ({
      id: `unit-${index + 1}`,
      number: index + 1,
      title: unit.title,
      titleZh: unit.titleZh,
      textbookPages: 'TODO',
      objectives: ['TODO: Add learning objectives'],
      lessons: [
        {
          id: `lesson-${index + 1}-1`,
          order: 1,
          title: 'TODO: Lesson 1',
          titleZh: '【待补充】第1课',
          topic: 'TODO: Add lesson topic',
          durationMinutes: 40,
          sceneTypes: ['slide', 'quiz'],
        },
      ],
    })),
  };
}

function generatePackYml(
  packId: string,
  gradeId: string,
  subjectId: string,
  unitNumber: number,
  unitTitle: string,
  unitTitleZh: string
) {
  return {
    id: packId,
    version: '0.1.0',
    gradeId,
    subjectId,
    unit: {
      id: `unit-${unitNumber}`,
      number: unitNumber,
      title: unitTitle,
      titleZh: unitTitleZh,
      lessons: [],
    },
    lessons: [
      {
        id: `lesson-${unitNumber}-1`,
        order: 1,
        title: 'TODO: Lesson 1',
        titleZh: '【待补充】第1课',
        topic: 'TODO: Add lesson topic for generation',
        durationMinutes: 40,
        sceneTypes: ['slide', 'quiz'],
      },
    ],
    reviewStatus: { status: 'draft' },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

// Main generation
const curriculumDir = path.dirname(new URL(import.meta.url).pathname);

let totalManifests = 0;
let totalPacks = 0;

for (const grade of GRADES) {
  for (const semester of SEMESTERS) {
    for (const [subjectZh, subject] of Object.entries(SUBJECTS)) {
      // Skip if subject not available for this grade
      if (!subject.gradesAvailable.includes(grade.level)) {
        continue;
      }

      const units = KNOWN_UNITS[grade.level]?.[semester.id]?.[subjectZh] || generateTodoUnits(6, subjectZh);

      // Create directory
      const subjectDir = path.join(curriculumDir, grade.nameZh, subjectZh);
      const semesterDir = path.join(subjectDir, semester.id);
      fs.mkdirSync(semesterDir, { recursive: true });

      // Generate manifest
      const manifest = generateManifest(grade, semester, subjectZh, subject, units);
      const manifestPath = path.join(semesterDir, 'manifest.yml');
      fs.writeFileSync(manifestPath, yaml.stringify(manifest), 'utf-8');
      totalManifests++;

      // Generate pack.yml for each unit
      for (let unitIndex = 0; unitIndex < units.length; unitIndex++) {
        const unit = units[unitIndex];
        const unitDir = path.join(semesterDir, `unit-${unitIndex + 1}`);
        fs.mkdirSync(unitDir, { recursive: true });

        const packId = `pack-grade-${grade.level}-${subject.id}-${semester.id === '上学期' ? 'fall' : 'spring'}-unit-${unitIndex + 1}`;
        const pack = generatePackYml(
          packId,
          `grade-${grade.level}`,
          subject.id,
          unitIndex + 1,
          unit.title,
          unit.titleZh
        );
        const packPath = path.join(unitDir, 'pack.yml');
        fs.writeFileSync(packPath, yaml.stringify(pack), 'utf-8');
        totalPacks++;
      }
    }
  }
}

console.log(`Generated ${totalManifests} manifests and ${totalPacks} pack stubs`);
console.log('\nStructure created:');
console.log('curriculum/');
for (const grade of GRADES) {
  console.log(`  ${grade.nameZh}/`);
  for (const [subjectZh, subject] of Object.entries(SUBJECTS)) {
    if (subject.gradesAvailable.includes(grade.level)) {
      console.log(`    ${subjectZh}/`);
      console.log(`      上学期/manifest.yml + unit-*/pack.yml`);
      console.log(`      下学期/manifest.yml + unit-*/pack.yml`);
    }
  }
}
