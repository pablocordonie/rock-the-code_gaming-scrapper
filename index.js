require('dotenv').config();
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { default: puppeteer } = require('puppeteer');

const gamingProductsSchema = new Schema({
    title: { type: String, required: true },
    img: { type: String },
    price: { type: String },
},
    {
        timestamps: true,
        collection: 'gaming_products'
    });

const Product = mongoose.model('gaming_products', gamingProductsSchema, 'gaming_products');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.DB_URL);
        console.log('Database connection status: online');
    } catch (error) {
        console.log('Database connection status: offline // Connection error: ', error);
    }
};

const gamingProductsScrapper = async (url) => {
    await connectDB();

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'load' });

    await page.waitForSelector('div.actions .main button.button.button-secondary');
    await page.$eval('div.actions .main button.button.button-secondary:last-of-type', (el) => el.click());

    await page.$eval('.games a.title-more', (el) => el.click());

    await page.waitForSelector('footer');
    const title = await page.$$eval('div.top-sales.listing-items .item .title', (nodes) => nodes.map(node => node.innerText));
    const img = await page.$$eval('div.top-sales.listing-items .item .picture', (nodes) => nodes.map(node => node.src));
    const price = await page.$$eval('div.top-sales.listing-items .item .price', (nodes) => nodes.map(node => node.innerText));

    const instantGamingProducts = title.map((value, index) => {
        return {
            title: title[index],
            img: img[index],
            price: price[index]
        }
    });

    instantGamingProducts.map(async (product) => {
        const productSchema = new Product(product);
        try {
            await productSchema.save();
            console.log(`${productSchema.title} has been successfully saved in the DB`);
        } catch (err) {
            console.error(`${productSchema.title} couldn't be saved in the DB, error: `, err);
        }
    });

    await browser.close();
};

gamingProductsScrapper('https://www.instant-gaming.com/es/');