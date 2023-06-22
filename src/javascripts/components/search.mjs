/* global XMLHttpRequest */
import accessibleAutocomplete from 'accessible-autocomplete'
import lunr from 'lunr'

import { trackSearchResults, trackConfirm } from './search.tracking.mjs'

// CONSTANTS
var TIMEOUT = 10 // Time to wait before giving up fetching the search index
var STATE_DONE = 4 // XHR client readyState DONE

// LunrJS Search index
var searchIndex = null
var documentStore = null

var statusMessage = null
var searchQuery = ''
var searchCallback = function () {}
// Results that are rendered by the autocomplete
var searchResults = []

// Timer that allows us to only fire events after a user has finished typing
var inputDebounceTimer = null

// We want to wait a bit before firing events to indicate that
// someone is looking at a result and not that it's come up in passing.
var DEBOUNCE_TIME_TO_WAIT = function () {
  // We want to be able to reduce this timeout in order to make sure
  // our tests do not run very slowly.
  var timeout = window.__SITE_SEARCH_TRACKING_TIMEOUT
  return (typeof timeout !== 'undefined') ? timeout : 2000 // milliseconds
}

function Search ($module) {
  this.$module = $module
}

Search.prototype.fetchSearchIndex = function (indexUrl, callback) {
  var request = new XMLHttpRequest()
  request.open('GET', indexUrl, true)
  request.timeout = TIMEOUT * 1000
  statusMessage = 'Loading search index'
  request.onreadystatechange = function () {
    if (request.readyState === STATE_DONE) {
      if (request.status === 200) {
        var response = request.responseText
        var json = JSON.parse(response)
        statusMessage = 'No results found'
        searchIndex = lunr.Index.load(json.index)
        documentStore = json.store
        callback(json)
      } else {
        statusMessage = 'Failed to load the search index'
      }
    }
  }
  request.send()
}

Search.prototype.renderResults = function () {
  if (!searchIndex || !documentStore) {
    return searchCallback(searchResults)
  }
  var lunrSearchResults = searchIndex.query(function (q) {
    q.term(lunr.tokenizer(searchQuery), {
      wildcard: lunr.Query.wildcard.TRAILING
    })
  })
  searchResults = lunrSearchResults.map(function (result) {
    return documentStore[result.ref]
  })
  searchCallback(searchResults)
}

Search.prototype.handleSearchQuery = function (query, callback) {
  searchQuery = query
  searchCallback = callback

  clearTimeout(inputDebounceTimer)
  inputDebounceTimer = setTimeout(function () {
    trackSearchResults(searchQuery, searchResults)
  }, DEBOUNCE_TIME_TO_WAIT())

  this.renderResults()
}

Search.prototype.handleOnConfirm = function (result) {
  var permalink = result.permalink
  if (!permalink) {
    return
  }
  trackConfirm(searchQuery, searchResults, result)
  window.location.href = '/' + permalink
}

Search.prototype.inputValueTemplate = function (result) {
  if (result) {
    return result.title
  }
}

Search.prototype.resultTemplate = function (result) {
  function startsWithFilter (words, query) {
    return words.filter(function (word) {
      return word.trim().toLowerCase().indexOf(query.toLowerCase()) === 0
    })
  }

  // Add rest of the data here to build the item
  if (result) {
    var elem = document.createElement('span')
    elem.textContent = result.title

    // Title split into words
    var words = result.title.match(/\w+/g) || []

    // Title words that start with the query
    var matchedWords = startsWithFilter(words, searchQuery)

    // Only show a matching alias if there are no matches in the title
    if (!matchedWords.length && result.aliases) {
      var aliases = result.aliases.split(', ')

      // Aliases containing words that start with the query
      var matchedAliases = aliases.reduce(function (aliasesFiltered, alias) {
        var aliasWordsMatched = startsWithFilter(alias.match(/\w+/g) || [], searchQuery)

        return aliasWordsMatched.length
          ? aliasesFiltered.concat([alias])
          : aliasesFiltered
      }, [])

      if (matchedAliases.length) {
        var aliasesContainer = document.createElement('span')
        aliasesContainer.className = 'app-site-search__aliases'
        aliasesContainer.textContent = matchedAliases.join(', ')
        elem.appendChild(aliasesContainer)
      }
    }

    var section = document.createElement('span')
    section.className = 'app-site-search--section'
    section.innerHTML = result.section

    elem.appendChild(section)
    return elem.innerHTML
  }
}

Search.prototype.init = function () {
  var $module = this.$module
  if (!$module) {
    return
  }

  accessibleAutocomplete({
    element: $module,
    id: 'app-site-search__input',
    cssNamespace: 'app-site-search',
    displayMenu: 'overlay',
    placeholder: 'Search Design System',
    confirmOnBlur: false,
    autoselect: true,
    source: this.handleSearchQuery.bind(this),
    onConfirm: this.handleOnConfirm,
    templates: {
      inputValue: this.inputValueTemplate,
      suggestion: this.resultTemplate
    },
    tNoResults: function () { return statusMessage }
  })

  var $input = $module.querySelector('.app-site-search__input')

  // Ensure if the user stops using the search that we do not send tracking events
  $input.addEventListener('blur', function (event) {
    clearTimeout(inputDebounceTimer)
  })

  var searchIndexUrl = $module.getAttribute('data-search-index')
  this.fetchSearchIndex(searchIndexUrl, function () {
    this.renderResults()
  }.bind(this))
}

export default Search
