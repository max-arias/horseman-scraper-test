const Horseman = require('node-horseman')
const cheerio = require('cheerio')
const fs = require('fs')
const _ = require('lodash')
const json2csv = require('json2csv')
const csvtojson = require('csvtojson')
const json2xls = require('json2xls')

const mainUrl = 'https://www.dermstore.com/'
const allBrandsUrl = 'https://www.dermstore.com/all_Brands_100.htm'
const allBrands = []
let firstRun = false
let totalProds = 0
let prodProcessed = 0

const appendToBrandFile = (dataIn, filename) => {
  const result = json2csv({ data: dataIn, hasCSVColumnTitle: !firstRun })

  if (!firstRun) firstRun = true
  prodProcessed++

  fs.appendFile(filename, result, function (err) {
    if (err) throw err
    // console.log('Appended brand data!')
  })

  console.log(`Product ${prodProcessed} / ${totalProds}`)

  if (prodProcessed === totalProds) {
    csvtojson()
    .fromFile(filename)
    .on('json', (jsonObj) => {
      const xls = json2xls(jsonObj)
      fs.writeFileSync('data.xlsx', xls, 'binary')
      console.log('Product data exported to XLSX!')
    })
  }
}

const scrapeProductData = (html) => {
  const $ = cheerio.load(html)

  const productPrice = $('#pricing radiogroup label:first-child span strong').text()
  const prodInfoItemName = $('#prod-info').find('.prod-name').text()
  const prodSize = prodInfoItemName.match(/\((.*)\)/)[1]
  let prodShortDesc = $('#prod-info').find('p[itemprop="description"]').get(0).firstChild.nodeValue.trim()

  return {
    cost: productPrice,
    size: prodSize,
    shortDesc: prodShortDesc
  }
}

const processProductPage = (products) => {
  products = [products[0]]
  totalProds = products.length
  products.forEach((prod) => {
    console.log('prod.url', prod.url)

    let horseman = new Horseman()
    horseman
      .userAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0')
      .open(prod.url)
      .html()
      .then((html) => {
        let productData = scrapeProductData(html)
        prod = _.assign({}, prod, productData)
        appendToBrandFile(prod, 'prod-data.json')
      })
      .close()
  })
}

const scrapeBrandProductsHtml = (brand, html) => {
  const $ = cheerio.load(html)

  let brandProducts = []

  $('#prodGrid .prod-widget-responsive > a').each(function (index, prod) {
    try {
      brandProducts.push({
        id: prod.parent.attribs['data-product-id'],
        name: prod.attribs.title,
        url: mainUrl + prod.attribs.href
      })
    } catch (e) {
      console.log(e)
    }
  })

  fs.writeFile('brand-products.json', JSON.stringify(brandProducts, null, 4), function (err) {
    console.log('Brand product file written')
  })

  processProductPage(brandProducts)
}

const scrapeBrandProducts = (brands) => {
  brands.forEach((brand) => {
    console.log('Brand: ', brand.name)
    let horseman = new Horseman()

    horseman
      .userAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0')
      .open(brand.url)
      .waitForSelector('#prodGrid .col-sm-4 .prod-widget-responsive')
      .html()
      .then((html) => scrapeBrandProductsHtml(brand, html))
      .close()
  })
}

const scrapeAllBrands = (html) => {
  const $ = cheerio.load(html)

  $('#allBrandsContainer .col-xs-6.col-md-3 a').each(function (item) {
    const href = $(this).attr('href')
    const brand = {
      name: $(this).text(),
      url: `${mainUrl}${href}`
    }
    allBrands.push(brand)
  })

  fs.writeFile('brands.json', JSON.stringify(allBrands, null, 4), (err) => {
    console.log('Brands retrieved - brands.json')
  })

  scrapeBrandProducts([allBrands[0]])
}

// Start
let horseman = new Horseman()
horseman
  .userAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0')
  .open(allBrandsUrl)
  .html()
  .then((html) => scrapeAllBrands(html))
  .close()
