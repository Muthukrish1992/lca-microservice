const logger = require('../utils/logger');
const { HTTP_STATUS, formatResponse } = require('../utils/http');
const { getAccountPlan } = require('../services/account.service');
const transportDatabase = require('../data/transport_database.json');
const transportDatabaseBasic = require('../data/country_distances.json');
const portDistances = require('../data/port_distances.json');

/**
 * Get transport database
 * @route GET /api/transportDB
 */
const getTransportDB = async (req, res) => {
  try {
    const plan = await getAccountPlan(req);
    if (plan.plan === "basic") {
      res.status(HTTP_STATUS.OK).json(formatResponse(
        true,
        {
          transportDatabase: Object.keys(transportDatabaseBasic),
          plan: plan,
        }
      ));
    } else {
      res.status(HTTP_STATUS.OK).json(formatResponse(
        true,
        { transportDatabase: transportDatabase, plan: plan }
      ));
    }
  } catch (error) {
    logger.error(error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      "An error occurred while retrieving transport database."
    ));
  }
};

/**
 * Get distance between locations
 * @route POST /api/distance
 */
const getDistance = async (req, res) => {
  try {
    const { origin, destination } = req.body;

    const plan = await getAccountPlan(req);

    let distance;

    if (plan.plan == "basic") {
      distance = transportDatabaseBasic[origin][destination];
    } else {
      const originDistances = portDistances[origin];

      if (!originDistances) {
        return res.status(HTTP_STATUS.NOT_FOUND).json(formatResponse(
          false,
          null,
          `Origin port '${origin}' not found.`
        ));
      }

      distance = originDistances[destination];

      if (distance === undefined) {
        return res.status(HTTP_STATUS.NOT_FOUND).json(formatResponse(
          false,
          null,
          `Destination port '${destination}' not found for origin '${origin}'.`
        ));
      }
    }

    res.status(HTTP_STATUS.OK).json(formatResponse(
      true,
      { origin, destination, distance_in_km: distance }
    ));
  } catch (error) {
    logger.error(error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      "An error occurred while retrieving distance."
    ));
  }
};

module.exports = {
  getTransportDB,
  getDistance
};