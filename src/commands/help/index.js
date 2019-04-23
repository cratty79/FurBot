import Promise from 'bluebird';
import nconf from 'nconf';
import path from 'path';
import R from 'ramda';

import { getGuildPrefix } from '../../redis';

import logger from '../../logger';
import meme from './meme';
import T from '../../translate';


const help_parameters = {};
const categories = {
  help: ['info', 'invite'],
  actions: [],
  moderation: [],
  images: [],
  info: [],
  fun: ['memelist'],
  lewd: [],
  games: [],
  useful: [],
  other: []
};

// Temporary workaround to fix tests failing.
if (!process.env.TEST) {
  const command_files = require('../').command_files;

  // Merge all the help objects together
  R.forEach(js_path => {
    const help_data = require(js_path).help;
    if (help_data) {
      const dir_name = path.basename(path.dirname(js_path));
      R.forEach(command => {
        const category = help_data[command].category || dir_name;
        if (!categories[category]) return logger.warn(`${command} does not have a category. It will not be added to the help information.`);

        categories[category].push(command);
        help_parameters[command] = help_data[command];
      }, R.keys(help_data));
    }
  }, command_files);
}

export function subCommands(client, evt, method, lang) {
  let guildToFind;
  if (!evt.message.channel.isPrivate) guildToFind = evt.message.guild.id;
  if (evt.message.channel.isPrivate) guildToFind = '0';
  getGuildPrefix(guildToFind).then(guildPrefix => {
    const subcommands = R.sort(R.prop('name'))(help_parameters[method].subcommands);

    let text = R.map(subcommand => {
      const trans_key = `${method}_${subcommand.name.replace(/ /g, '_')}`;
      const translation = T(trans_key, lang);
      if (!translation) return;

      const secondary_name = subcommand.secondary_name ? `\` or \`${subcommand.secondary_name}` : '';
      if (subcommand.parameters && help_parameters[method].prefix !== false) {
        const parameters = !R.is(String, subcommand.parameters) ? R.join(' ', subcommand.parameters) : subcommand.parameters;
        return `**\`${guildPrefix}${method}\`** \`${subcommand.name}${secondary_name} \`__\`${parameters}\`__
        ${translation}`;
      }
      if (subcommand.parameters && help_parameters[method].prefix === false) {
        return `**\`${guildPrefix}${subcommand.name}\`** \`${R.join(' ', subcommand.parameters)}\`
        ${translation}`;
      }
      if (!subcommand.parameters && help_parameters[method].prefix === false) {
        return `**\`${guildPrefix}${subcommand.name}\`**
        ${translation}`;
      }
      return `**\`${guildPrefix}${method}\`** \`${subcommand.name}${secondary_name}\`
      ${translation}`;
    }, subcommands);

    text = R.join('\n', R.reject(R.isNil, text));
    if (help_parameters[method].header_text) {
      const header_text = T(help_parameters[method].header_text, lang);
      text = `${header_text}\n\n${text}`;
    }

    return evt.message.channel.sendMessage(text);
  });
  return Promise.resolve(true);
}

// E.g. !help useful
function helpCategory(client, evt, category, lang = 'en') {
  let guildToFind;
  if (!evt.message.channel.isPrivate) guildToFind = evt.message.guild.id;
  if (evt.message.channel.isPrivate) guildToFind = '0';
  getGuildPrefix(guildToFind).then(guildPrefix => {
    let methods;
    methods = categories[category].sort();
    let assistText = '';

    if (category === 'images') {
      assistText = T('assist_images', lang);
    }

    const text = R.map(name => {
      const translation = T(name, lang);
      if (!translation && category !== 'other' && !R.contains(name, categories.other)) return;

      let parameters;
      if (help_parameters[name] && help_parameters[name].parameters) {
        parameters = !R.is(String, help_parameters[name].parameters) ? R.join(' ', help_parameters[name].parameters || []) : help_parameters[name].parameters;
      }
      let text = `**\`${guildPrefix}${name}\`**`;
      if (parameters) text += ` \`${parameters}\``;
      if (translation) text += `\n\t\t${translation}`;

      return text;
    }, methods);

    return evt.message.channel.sendMessage(assistText + R.join('\n', R.reject(R.isNil, text)));
  });
  return Promise.resolve(true);
}

function help(client, evt, suffix, lang) {
  let guildToFind;
  if (!evt.message.channel.isPrivate) guildToFind = evt.message.guild.id;
  if (evt.message.channel.isPrivate) guildToFind = '0';
  getGuildPrefix(guildToFind).then(guildPrefix => {
    const category = suffix.toLowerCase();
    if (categories[category]) return helpCategory(client, evt, category, lang);
    const help_methods = R.keys(categories).sort();
    // help_methods.push('all');
    help_methods.splice(help_methods.indexOf('help'), 1);

    const text = R.map(param => {
      return `**\`${guildPrefix}help\`** \`${param}\`
      ${T('help_' + param, lang)}`;
    }, help_methods);

    // Adds commands that aren't just `help`;
    R.forEach(name => {
      const translation = T(name, lang);
      if (!translation) return;

      let parameters;
      if (help_parameters[name]) {
        parameters = !R.is(String, help_parameters[name].parameters) ? R.join(' ', help_parameters[name].parameters || []) : help_parameters[name].parameters;
      }

      let command_text = `**\`${guildPrefix}${name}\`**`;
      if (parameters) command_text += ` \`${parameters}\``;
      if (translation) command_text += `\n\t${translation}`;
      text.push(command_text);
    }, categories.help);

    return evt.message.channel.sendMessage(R.join('\n', text));
  });
  return Promise.resolve(true);
}

function memelist(client, evt, suffix) {
  suffix = suffix.toLowerCase();
  if (suffix === '1') {
    client.Users.get(evt.message.author.id).openDM().then(dm => dm.sendMessage(meme.list1));
  } else if (suffix === '2') {
    client.Users.get(evt.message.author.id).openDM().then(dm => dm.sendMessage(meme.list2));
  } else if (suffix === '3') {
    client.Users.get(evt.message.author.id).openDM().then(dm => dm.sendMessage(meme.list3));
  } else if (suffix === 'full') {
    client.Users.get(evt.message.author.id).openDM().then(dm => dm.sendMessage(meme.list1));
    client.Users.get(evt.message.author.id).openDM().then(dm => dm.sendMessage(meme.list2));
    client.Users.get(evt.message.author.id).openDM().then(dm => dm.sendMessage(meme.list3));
  } else {
    return Promise.resolve(meme.all);
  }
}

export default {
  commands: help,
  help,
  memelist
};
