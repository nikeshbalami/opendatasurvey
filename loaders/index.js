'use strict';

var _ = require('underscore');
var config = require('../config');
var models = require('../models');
var entitiesConstructor = require('./includes/entitiesConstructor');
var spreadSheetHandler = require('./includes/spreadSheetHandler');
var dbTransactions = require('./includes/dbTransactions');


var indexLoader = {
  /*
   * load Places from sheet to DB
   */
  loadPlaces: function (params) {
    var configUrl = params['configUrl'] || false;
    if (configUrl) {
      var placesUrlKey = spreadSheetHandler.getPlacesUrlKey(configUrl);
      var placesSpreadSheetUrl = spreadSheetHandler.getPlacesSpreadSheetUrl(placesUrlKey);
      return spreadSheetHandler.parse(placesSpreadSheetUrl)
        .spread(function (err, parsedPlaces) {
          if (err) {
            return [err, false];
          } else {
            var site = params['subDomain'];
            var mappedPlaces = false;
            parsedPlaces = entitiesConstructor.setSiteValue(parsedPlaces, site);
            mappedPlaces = entitiesConstructor.mapPlaces(parsedPlaces);
            return Promise.each(mappedPlaces, function (signleMappedPlace) {
              return dbTransactions.checkIfPlaceExist(signleMappedPlace['site'])
                .spread(function (err, isRecordExist, recordData) {
                  if (err) {
                    return [err, false];
                  } else {
                    return handleCheckIfExistResult(isRecordExist, recordData);
                  }
                });
            }).then(function () {
              return voidSavePlacesProcess(mappedPlaces);
            });
          }
        });
    } else {
      return new Promise(function (resolve, reject) {
        resolve(['reload failed', false]);
      });
    }

  },
  /*
   * load Datasets from sheet to DB
   */
  loadDatasets: function (params) {
    var configUrl = params['configUrl'];
    var datasetsUrlKey = spreadSheetHandler.getDatasetsUrlKey(configUrl);
    var datasetsSpreadSheetUrl = spreadSheetHandler.getDatasetsSpreadSheetUrl(datasetsUrlKey);

    return spreadSheetHandler.parse(datasetsSpreadSheetUrl)
      .spread(function (err, parsedDatasets) {
        if (err) {
          return [err, false];
        } else {
          var site = params['subDomain'];
          var mappedDataset = false;
          parsedDatasets = entitiesConstructor.setSiteValue(parsedDatasets, site);
          mappedDataset = entitiesConstructor.mapDatasets(parsedDatasets);
          return Promise.each(mappedDataset, function (signleMappedDataset) {
            return dbTransactions.checkIfDatasetExist(signleMappedDataset['site'])
              .spread(function (err, isRecordExist, recordData) {
                if (err) {
                  return [err, false];
                } else {
                  return handleCheckIfExistResult(isRecordExist, recordData);
                }
              });
          }).then(function () {
            return voidSaveDatasetsProcess(mappedDataset);
          });
        }
      });
  },
  /*
   * load Questions from sheet to DB
   */
  loadQuestions: function (params) {
    var configUrl = params['configUrl'];
    var questionsUrlKey = spreadSheetHandler.getDatasetsUrlKey(configUrl);
    var questionsSpreadSheetUrl = spreadSheetHandler.getQuestionsSpreadSheetUrl(questionsUrlKey);

    return spreadSheetHandler.parse(questionsSpreadSheetUrl)
      .spread(function (err, parsedQuestions) {
        if (err) {
          return [err, false];
        } else {
          var site = params['subDomain'];
          var mappedQuestions = false;
          parsedQuestions = entitiesConstructor.setSiteValue(parsedQuestions, site);
          mappedQuestions = entitiesConstructor.mapQuestions(parsedQuestions);
          return Promise.each(mappedQuestions, function (signleMappedQuestion) {
            return dbTransactions.checkIfQuestionExist(signleMappedQuestion['site'])
              .spread(function (err, isRecordExist, recordData) {
                if (err) {
                  return [err, false];
                } else {
                  return handleCheckIfExistResult(isRecordExist, recordData);
                }
              });
          }).then(function () {
            return voidSaveQuestionsProcess(mappedQuestions);
          });
        }
      });
  },
  /*
   * load Config (Site) from sheet to DB
   */
  loadConfig: function (params) {
    var site = params['subDomain'];
    var configUrl = params['configUrl'];

    return spreadSheetHandler.parse(configUrl)
      .spread(function (err, configData) {
        if (err) {
          return [err, false];
        } else {
          var mappedConfig = false;
          var deparsedConfig = false;

          deparsedConfig = entitiesConstructor.deparseConfig(configData);
          deparsedConfig = entitiesConstructor.setConfigId(deparsedConfig, site);
          mappedConfig = entitiesConstructor.mapConfig(deparsedConfig);

          if (mappedConfig) {
            return dbTransactions.checkIfConfigExist(site)
              .spread(function (err, isRecordExist, recordData) {
                if (err) {
                  return [err, false];
                } else {
                  return handleCheckIfExistResult(isRecordExist, recordData);
                }
              }).then(function () {
              return voidSaveConfigProcess(mappedConfig);
            });
          } else {
            return ['could not reload config', false];
          }
        }
      });
  }
};
//get suitable registry from registry array
function pullRequiredRegistryFromArray(registryArray, siteId) {
  var result = false;
  for (var i = 0; i < registryArray.length; i++) {
    var currentRegistry = registryArray[0];
    if (currentRegistry['censusid'] === siteId) {
      result = currentRegistry;
      break;
    }
  }
  return result;
}

//check if entity exists in database
function handleCheckIfExistResult(isRecordExist, recordData) {
  if (isRecordExist) {
    return dbTransactions.deleteRecord(recordData);
  } else {
    return [false, true];
  }
}

//process places creation
function voidSavePlacesProcess(object) {
  return dbTransactions.savePlaces(object)
    .spread(function (err, saveResult) {
      return handleSaveResult(err, saveResult);
    });
}

//process datasets creation
function voidSaveDatasetsProcess(object) {
  return dbTransactions.saveDatasets(object)
    .spread(function (err, saveResult) {
      return handleSaveResult(err, saveResult);
    });
}

//process questions creation
function voidSaveQuestionsProcess(object) {
  return dbTransactions.saveQuestions(object)
    .spread(function (err, saveResult) {
      return handleSaveResult(err, saveResult);
    });
}

//process registry creation
function voidSaveRegistryProcess(object) {
  return dbTransactions.saveRegistry(object)
    .spread(function (err, saveResult) {
      return handleSaveResult(err, saveResult);
    });
}

//process config creation
function voidSaveConfigProcess(object) {
  return dbTransactions.saveConfig(object)
    .spread(function (err, saveResult) {
      return handleSaveResult(err, saveResult);
    });
}

//handle results of save functionality
function handleSaveResult(err, saveResult) {
  var result = false;
  if (err) {
    result = [err, false];
  } else {
    result = [false, saveResult];
  }
  return result;
}

var loadRegistry = function () {

  var registryUrl = config.get('registryUrl') || false;

  return spreadSheetHandler.parse(registryUrl)
    .spread(function (err, registry) {
      if (err) {
        return [err, false];
      } else {

        var cleanObject = function(value, key, list) {
          if (key === 'censusid') {
            delete list[key]
          }
        };

        var prepData = function(element, index, list) {
          var treated = {};
          treated.id = element.censusid;
          treated.settings = _.each(element, cleanObject);
          list[index] = treated;
        };

        var queryHandler = function(result) {
          console.log('query handler');
          console.log(result);
        };

        var normalized = _.each(registry, prepData);
        if (normalized) {
          var queryResults = [];

          // make each upsert (can't do a bulk with upsert, but that is ok for our needs here)
          // _.each(registry, queryHandler);
          // return the array of promises, or whatever, so the view just calls spread and responds

          //return models.Registry.upsert(normalized[0]).then(queryHandler);

          // dbTransactions.checkIfRegistryExist(site)
          //   .spread(function (err, isRecordExist, recordData) {
          //     if (err) {
          //       return [err, false];
          //     } else {
          //       return handleCheckIfExistResult(isRecordExist, recordData);
          //     }
          //   }).then(function () {
          //     return voidSaveRegistryProcess(mappedRegistry);
          //   });
        } else {
          return ['could not reload registry', false];
        }
      }
    });
};


module.exports = {
  loadRegistry: loadRegistry
};