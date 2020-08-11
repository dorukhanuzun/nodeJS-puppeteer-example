const Product = require('../models/product');

const puppeteer = require('puppeteer');

const sleep = async time =>  new Promise(resolve => setTimeout(resolve, time * 1000));

exports.index = async (req, res) => {
  const products = await Product.find();
  
  res.render('products/index', {
    pageTitle: 'AM4Z0N Products',
    products
  });
};

exports.update = async (req, res) => {
  const url = 'https://www.amazon.ca/gp/new-releases/pet-supplies/6291911011?ref_=Oct_s9_apbd_onr_hd_bw_b6roDTf_S&pf_rd_r=NRDBCY3MNPAVRS4T474F&pf_rd_p=d54a3cbe-eb56-5564-8e0c-e1eaddec8c8e&pf_rd_s=merchandised-search-10&pf_rd_t=BROWSE&pf_rd_i=6291911011';
  const products = await scrapeIt(url);

  console.log(products);

  // Write the content to the database, or update existing ones (based on SKU)
  for (let product of products) {
    if (product.title === "" || product.price === "") continue;
    await Product.updateOne({sku: product.sku}, product, {upsert: true});
  }

  res.redirect('/products');
};

async function scrapeIt (url) {
  // Create a new browser instance
  const browser = await puppeteer.launch({headless: false});

  // Close the location request
  const context = browser.defaultBrowserContext();
  await context.overridePermissions(url, ['geolocation']);

  // Create a new page context
  const page = await browser.newPage();
  await page.setViewport({
    width: 1920,
    height: 1080
  });

  // Pass our sleep function
  await page.exposeFunction('sleep', sleep);

  // Close any prompts/alerts/confirms
  page.on('dialog', async dialog => {
    await dialog.dismiss();
  });

  // Expose the console
  page.on('console', msg => console.log(msg._text));

  // Navigate to the URL
  await page.goto(url);
  await sleep(2);
  // await page.screenshot({path: 'assets/screenshots/example.png'});
  
  await page.evaluate(async () => {
    window.scrollBy(0, document.body.scrollHeight);
    await sleep(2);
  });
  await page.waitForSelector(`[id^="zg-ordered-list"]`, {visible: true, timeout: 120});

  // Run some JavaScript on the page
  const content = await page.evaluate(async () => {
    const productScrape = document.querySelectorAll('.zg-item-immersion');
    console.log(productScrape);
    const products = [];

    for (let product of productScrape) {
      if (!product.querySelector('img')) {
        product.scrollIntoView();
        await sleep(2);
      }

      // Get the SKU
      const link = product.querySelector(`[class^="a-link-normal"]`).href;
      const parts = link.split('/');
      const sku = parts[parts.length - 3];

      const title = product.querySelector(`[class^="p13n-sc-truncate"]`).title;
      const price = product.querySelector(`[class^="p13n-sc-price"]`).textContent;
      const image = product.querySelector('img');
      let src = null;
      if (image) src = image.src;

      products.push({sku, title, price, image: src});
    }

    return products;
  });

  // Close our browser
  await browser.close();
  return content;
}
