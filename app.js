import express from 'express';
import { PrismaClient } from './generated/prisma/index.js';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// ---------- Constants & helpers ----------

const CATEGORIES = {
  sale: { label: '📦 Продаж' },
  service: { label: '🔧 Послуги' },
  job: { label: '💼 Робота' },
  other: { label: '📌 Інше' },
};

const VALID_CATEGORIES = Object.keys(CATEGORIES);
const PER_PAGE = 10;

const UA_MONTHS = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
];

function formatDate(date) {
  const d = new Date(date);
  const day = d.getDate();
  const month = UA_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

function categoryLabel(category) {
  return CATEGORIES[category]?.label || category;
}

// Make helpers available in every EJS template automatically
app.locals.categories = CATEGORIES;
app.locals.formatDate = formatDate;
app.locals.categoryLabel = categoryLabel;

// ---------- Middleware ----------

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// ---------- Routes ----------

// Головна сторінка: список, пошук, сортування, пагінація
app.get('/', async (req, res, next) => {
  const { search, sort = 'newest', page = 1 } = req.query;

  const pageNum = Number(page) > 0 ? Number(page) : 1;

  let orderBy = { createdAt: 'desc' };
  if (sort === 'oldest') {
    orderBy = { createdAt: 'asc' };
  }

  const skip = (pageNum - 1) * PER_PAGE;

  // Примітка: SQLite (через LIKE) не робить нечутливе до регістру
  // порівняння для кирилиці, тому пошук по назві реалізовано незалежно
  // від регістру вручну у JavaScript, а не через Prisma "contains".
  let announcements;
  let total;

  if (search) {
    const needle = search.toLowerCase();
    const all = await prisma.announcement.findMany({ orderBy });
    const filtered = all.filter((a) => a.title.toLowerCase().includes(needle));
    total = filtered.length;
    announcements = filtered.slice(skip, skip + PER_PAGE);
  } else {
    const [found, count] = await Promise.all([
      prisma.announcement.findMany({ orderBy, skip, take: PER_PAGE }),
      prisma.announcement.count(),
    ]);
    announcements = found;
    total = count;
  }

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  res.render('index', {
    announcements,
    search: search || '',
    sort,
    currentPage: pageNum,
    totalPages,
  });
});

// Форма створення оголошення
app.get('/announcements', (req, res) => {
  res.render('new', {
    errors: {},
    data: null,
  });
});

// Обробка створення оголошення
app.post('/announcements', async (req, res) => {
  const { title, description, price, category, contactInfo } = req.body;
  const errors = {};

  if (!title || title.trim().length < 5 || title.trim().length > 100) {
    errors.title = 'Назва має бути від 5 до 100 символів';
  }

  if (!description || description.trim().length < 10) {
    errors.description = 'Опис має бути не менше 10 символів';
  }

  if (!VALID_CATEGORIES.includes(category)) {
    errors.category = 'Оберіть категорію';
  }

  if (!price || isNaN(price) || Number(price) <= 0) {
    errors.price = 'Ціна має бути додатним числом';
  }

  if (!contactInfo || contactInfo.trim().length < 5) {
    errors.contactInfo = 'Контактна інформація має бути не менше 5 символів';
  }

  if (Object.keys(errors).length > 0) {
    return res.render('new', {
      errors,
      data: req.body,
    });
  }

  const announcement = await prisma.announcement.create({
    data: {
      title: title.trim(),
      description: description.trim(),
      price: Number(price),
      category,
      contactInfo: contactInfo.trim(),
    },
  });

  res.redirect(`/announcements/${announcement.id}`);
});

// Перегляд одного оголошення
app.get('/announcements/:id', async (req, res, next) => {
  const id = Number(req.params.id);

  if (isNaN(id)) {
    return res.status(404).render('404');
  }

  const announcement = await prisma.announcement.findUnique({
    where: { id },
  });

  if (!announcement) {
    return res.status(404).render('404');
  }

  res.render('announcement', { announcement });
});

// Видалення оголошення
app.delete('/announcements/:id', async (req, res, next) => {
  const id = Number(req.params.id);

  if (isNaN(id)) {
    return res.status(404).render('404');
  }

  await prisma.announcement.delete({
    where: { id },
  });

  res.status(204).end();
});

// ---------- 404 Handler ----------
app.use((req, res) => {
  res.status(404).render('404');
});

// ---------- Error Handler ----------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error');
});

app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});
