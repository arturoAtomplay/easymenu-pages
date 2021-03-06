const { Message, MessageComponentInteraction } = require("discord.js");
const { EventEmitter } = require("events");

class Page {
  /**
   * @param {string} name
   * @param {import('discord.js').MessageOptions} message
   * @param {Object.<string, string | function>} componentsActions
   */
  constructor(name, message, componentsActions) {
    this.name = name;
    this.message = message;
    this.componentsActions = componentsActions;
  }
}

module.exports = class EasyMenu extends (
  EventEmitter
) {
  /**
   * @param {Object} param0
   * @param {import("discord.js").TextBasedChannels} param0.channel channel where the message will be sent
   * @param {string|string[]} [param0.usersID] if you use a filter this does not work
   * @param {(interaction: MessageComponentInteraction) => boolean} [param0.filter] The filter applied to this collector
   * @param {number} [param0.ms] collector time in milliseconds
   * @param {Object[]} param0.pages pages
   * @param {string} param0.pages.name Name of the page
   * @param {import('discord.js').MessageOptions} param0.pages.message see [here](https://discord.js.org/#/docs/main/13.1.0/typedef/MessageOptions) for more details
   * @param {Object.<string, string | function>} [param0.pages.componentsActions] component actions
   */
  constructor({ channel, usersID, filter, ms = 180000, pages }) {
    super();
    this.channel = channel;
    this.usersID = typeof usersID === "string" ? [usersID] : usersID;

    /** @private */
    this.customFilter = filter || null

    this.ms = ms;

    /** @type {Page[]} */
    this.pages = [];

    pages.forEach(page => {
      this.pages.push(new Page(page.name, page.message, page.componentsActions || {}));
    });

    /** @type {Page} */
    this.currentPage = this.pages[0];

    /** @type {number} */
    this.pageIndex = 0;
  }

  /**
   * Starts the menu sending the first menu of the array
   * @return {Promise<Message>} If there is an error sending the message, it returns an error
   * @example
   * menu.start().catch(console.log);
   */
  start() {
    return new Promise((resolve, reject) => {
      this.channel
        .send(this.currentPage.message)
        .then(msgMenu => {
          resolve(msgMenu)
          this.msgMenu = msgMenu;
          this.awaitComponents();
        })
        .catch(reject);
    });
  }

  /** stop the collector */
  stop() {
    this.menuCollector.stop("STOP");
  }

  /**
   * stop the collector and delete the message
   * @returns {Promise<Message>} If there is an error clearing the message, it returns an error.
   * @example
   * menu.delete().catch(console.log);
   */
  delete() {
    return new Promise((resolve, reject) => {
      if (this.menuCollector) this.menuCollector.stop("DELETE");
      if (this.msgMenu) this.msgMenu.delete().then(resolve).catch(reject);
    });
  }

  /**
   * Changes the page is exists the position in the array, otherwise it won't do anything
   * @param {number} pageIndex Must be the position of the array element where IT will change
   * @return {Promise<Message>} If there is an error when is editing the message, it will return it
   */
  setPage(pageIndex = 0) {
    return new Promise((resolve, reject) => {
      if (!this.pages[pageIndex]) return;
      const oldPage = this.currentPage
      this.pageIndex = pageIndex;
      this.currentPage = this.pages[pageIndex];
      this.msgMenu.edit(this.currentPage.message).then(resolve).catch(reject);
      this.emit('pageChange', oldPage, this.currentPage);
    });
  }

  awaitComponents() {
    this.menuCollector = this.msgMenu.createMessageComponentCollector({
      filter: this.customFilter ? this.customFilter : i => this.usersID.some(u => u === i.user.id),
      idle: this.ms,
    });

    this.menuCollector.on("collect", interaction => {
      if (!(interaction.isSelectMenu() || interaction.isButton())) return;
      interaction.deferUpdate();
      const value = interaction.isSelectMenu() ? interaction.values[0] : interaction.customId;
      const actionName = Object.prototype.hasOwnProperty.call(this.currentPage.componentsActions, value) ? value : null;

      if (actionName && typeof this.currentPage.componentsActions[actionName] === "function")
        // @ts-ignore
        return this.currentPage.componentsActions[actionName]();

      switch (this.currentPage.componentsActions[actionName]) {
        case "delete":
          this.delete();
          break;

        default:
          this.setPage(this.pages.findIndex(p => p.name === this.currentPage.componentsActions[actionName]));
          break;
      }
    });

    this.menuCollector.on("end", (collected, reason) => {
      this.emit("collectorEnd", collected, reason);
    });
  }
};
