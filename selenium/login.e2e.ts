import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Builder, By, error, until, WebDriver, WebElement } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/chrome';

const BASE_URL = 'https://www.saucedemo.com/';
const TIMEOUT_MS = 15_000;
const EXPECTED_PRODUCT_COUNT = 6;

const VALID_USER = 'standard_user';
const LOCKED_USER = 'locked_out_user';
const PASSWORD = 'secret_sauce';

const DEMO = process.argv.includes('--demo');
const DEMO_STEP_MS = 1_000;
const DEMO_HOLD_MS = 3_000;

async function demoPause(driver: WebDriver, ms = DEMO_STEP_MS): Promise<void> {
  if (DEMO) {
    await driver.sleep(ms);
  }
}

const byTestId = (value: string): By => By.css(`[data-test="${value}"]`);

const locators = {
  username: byTestId('username'),
  password: byTestId('password'),
  loginButton: byTestId('login-button'),
  error: byTestId('error'),
  productList: byTestId('inventory-list'),
  productCard: byTestId('inventory-item'),
  productName: byTestId('inventory-item-name'),
  productPrice: byTestId('inventory-item-price'),
  doesNotExist: byTestId('element-that-does-not-exist'),
};

async function createDriver(): Promise<WebDriver> {
  const options = new Options();
  options.addArguments('--window-size=1280,900');
  options.addArguments('--disable-features=PasswordLeakDetection');
  options.setUserPreferences({
    credentials_enable_service: false,
    'profile.password_manager_enabled': false,
    'profile.password_manager_leak_detection': false,
  });
  if (process.argv.includes('--headless')) {
    options.addArguments('--headless=new');
  }

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  // Implicit wait stays 0: mixing implicit and explicit waits makes wait times unpredictable.
  await driver.manage().setTimeouts({ implicit: 0, pageLoad: TIMEOUT_MS });
  return driver;
}

class PerformanceTimeout extends Error {
  constructor(readonly step: string) {
    super(`${step} exceeded ${TIMEOUT_MS / 1000}s`);
    this.name = 'PerformanceTimeout';
  }
}

async function step<T>(name: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (err) {
    if (err instanceof error.TimeoutError) {
      console.error(`[PERFORMANCE] Test failed: ${name} exceeded 15s`);
      throw new PerformanceTimeout(name);
    }
    throw err;
  }
}

async function waitVisible(
  driver: WebDriver,
  locator: By,
  what: string,
): Promise<WebElement> {
  const element = await step(`waiting for ${what}`, () =>
    driver.wait(until.elementLocated(locator), TIMEOUT_MS),
  );
  await step(`waiting for ${what} to be visible`, () =>
    driver.wait(until.elementIsVisible(element), TIMEOUT_MS),
  );
  return element;
}

async function openLoginPage(driver: WebDriver): Promise<void> {
  await step('loading the login page', () => driver.get(BASE_URL));
  await demoPause(driver);
}

async function login(
  driver: WebDriver,
  username: string,
  password: string,
): Promise<void> {
  const usernameInput = await waitVisible(driver, locators.username, 'username field');
  const passwordInput = await waitVisible(driver, locators.password, 'password field');
  const loginButton = await waitVisible(driver, locators.loginButton, 'login button');

  await usernameInput.clear();
  await usernameInput.sendKeys(username);
  await demoPause(driver);
  await passwordInput.clear();
  await passwordInput.sendKeys(password);
  await demoPause(driver);

  assert.equal(await usernameInput.getProperty('value'), username, 'username field value');
  assert.equal(await passwordInput.getProperty('value'), password, 'password field value');

  await loginButton.click();
}

async function validLogin(driver: WebDriver): Promise<void> {
  await openLoginPage(driver);
  await login(driver, VALID_USER, PASSWORD);

  await step('redirect to /inventory.html', () =>
    driver.wait(until.urlContains('/inventory.html'), TIMEOUT_MS),
  );
  const productList = await waitVisible(driver, locators.productList, 'product list');

  assert.ok(
    (await driver.getCurrentUrl()).includes('/inventory.html'),
    'URL should contain /inventory.html after login',
  );
  assert.ok(await productList.isDisplayed(), 'product list should be displayed');

  const cards = await productList.findElements(locators.productCard);
  const products = await Promise.all(
    cards.map(async (card) => ({
      name: await card.findElement(locators.productName).getText(),
      price: await card.findElement(locators.productPrice).getText(),
    })),
  );
  console.table(products);

  assert.equal(products.length, EXPECTED_PRODUCT_COUNT, 'number of products');
  for (const product of products) {
    assert.ok(product.name.length > 0, 'product name should not be empty');
    assert.match(product.price, /^\$\d+\.\d{2}$/, `price format of ${product.name}`);
  }
}

async function expectLoginError(
  driver: WebDriver,
  username: string,
  password: string,
  expectedMessage: RegExp,
): Promise<void> {
  await openLoginPage(driver);
  const urlBefore = await driver.getCurrentUrl();
  await login(driver, username, password);

  const errorBox = await waitVisible(driver, locators.error, 'error message');
  const message = await errorBox.getText();
  console.log(`  error shown: "${message}"`);

  assert.match(message, expectedMessage);
  assert.equal(await driver.getCurrentUrl(), urlBefore, 'URL should not change');
  assert.equal(
    (await driver.findElements(locators.productList)).length,
    0,
    'product list should not be present',
  );
}

async function timeoutDemo(driver: WebDriver): Promise<void> {
  await openLoginPage(driver);
  await step('waiting for a missing element', () =>
    driver.wait(until.elementLocated(locators.doesNotExist), TIMEOUT_MS),
  );
}

async function withDriver(run: (driver: WebDriver) => Promise<void>): Promise<void> {
  const driver = await createDriver();
  try {
    await run(driver);
  } finally {
    if (DEMO) {
      console.log(`  closing in ${DEMO_HOLD_MS / 1000}s`);
      await demoPause(driver, DEMO_HOLD_MS);
    }
    await driver.quit();
    console.log('  session closed');
  }
}

describe('saucedemo login', () => {
  it(`1. valid login lands on inventory with ${EXPECTED_PRODUCT_COUNT} products`, () =>
    withDriver(validLogin));

  it('2. invalid password shows credential error', () =>
    withDriver((driver) =>
      expectLoginError(driver, VALID_USER, 'wrong_password', /username and password do not match/i),
    ));

  it('3. locked-out user shows locked-out error', () =>
    withDriver((driver) => expectLoginError(driver, LOCKED_USER, PASSWORD, /locked out/i)));

  it('4. 15s timeout handler fires and closes the session', () =>
    assert.rejects(withDriver(timeoutDemo), PerformanceTimeout));
});
