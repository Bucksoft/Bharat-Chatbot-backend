import axios from "axios";
import * as cheerio from "cheerio";

export async function scrapeWebsite(url) {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    let text = "";
    $("p, h1, h2, h3, li").each((_, el) => {
      text += $(el).text() + "\n";
    });
    return text.trim();
  } catch (error) {
    console.log(`Failed to scrape website `);
  }
}
