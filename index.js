require('dotenv').config();
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { default: puppeteer } = require('puppeteer');

const instantGamingProducts = [];

const gamingProductsSchema = new Schema({
    title: { type: String, required: true },
    img: { type: String },
    price: { type: Number },
    stock: { type: String }
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

const dataCollector = async (page, browser) => {
    let arrayDivs = await page.$$(".force-badge");

    for (let gameDiv of arrayDivs) {
        let title = await gameDiv.$eval(".title", (el) => el.innerText);
        let img = await gameDiv.$eval("img", (el) => el.src);
        let price;

        try {
            price = await gameDiv.$eval(".price", (el) => Number(el.innerText.slice(0, el.innerText.length - 1)));

            const game = {
                title,
                img,
                price
            };
            instantGamingProducts.push(game);
        } catch (error) {
            const game = {
                title,
                img,
                stock: 'Not Available'
            };
            instantGamingProducts.push(game);
        }
    };

    try {
        await page.$eval("[title='Next']", (el) => el.click());
        await page.waitForNavigation();
        dataCollector(page, browser);
    } catch (error) {
        await browser.close();

        mongoose.connect(process.env.DB_URL).then(async () => {
            const gamesCollection = await Product.find();
            if (gamesCollection.length) {
                await Product.collection.drop();
                console.log(`The games collection's been dropped`);
            }
        }).catch(error => console.log(`Error deleting the games collection: ${error}`)).then(async () => {
            const gamingProductsData = instantGamingProducts.map(product => new Product(product));
            await Product.insertMany(gamingProductsData);
            console.log('All the gaming products have been successfully saved in the DB: ', instantGamingProducts);
        }).catch(error => console.error('An error has happened while saving the gaming products to the database: ', error));
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

    await page.$eval('#nav-nintendo a.access.mimic', (el) => el.click());
    await page.waitForSelector('#nav-nintendo-panel');
    await page.$eval('#nav-nintendo-panel .platforms a', (el) => el.click());

    await page.waitForSelector('footer');

    dataCollector(page, browser);
};

gamingProductsScrapper('https://www.instant-gaming.com/es/');