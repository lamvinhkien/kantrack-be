import Joi from 'joi'
import { StatusCodes } from 'http-status-codes'
import ApiError from '~/utils/ApiError'
import { BOARD_TYPES } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

const createNew = async (req, res, next) => {
  const correctCondition = Joi.object({
    title: Joi.string()
      .min(3)
      .max(35)
      .trim()
      .strict()
      .messages({
        'string.base': 'Title must be a text value.',
        'string.empty': 'Title cannot be empty.',
        'string.min': 'Title must be at least {#limit} characters long.',
        'string.max': 'Title must not exceed {#limit} characters.'
      }),
    type: Joi.string()
      .valid(BOARD_TYPES.PUBLIC, BOARD_TYPES.PRIVATE)
      .required()
      .messages({
        'any.required': 'Board type is required.',
        'string.base': 'Board type must be a text value.',
        'any.only': `Board type must be either "${BOARD_TYPES.PUBLIC}" or "${BOARD_TYPES.PRIVATE}".`
      })
  })

  try {
    await correctCondition.validateAsync(req.body, { abortEarly: false })
    next()
  } catch (error) {
    next(error)
  }
}

const update = async (req, res, next) => {
  const correctCondition = Joi.object({
    title: Joi.string()
      .min(3)
      .max(35)
      .trim()
      .strict()
      .messages({
        'string.base': 'Title must be a text value.',
        'string.empty': 'Title cannot be empty.',
        'string.min': 'Title must be at least {#limit} characters long.',
        'string.max': 'Title must not exceed {#limit} characters.'
      }),
    type: Joi.string()
      .valid(BOARD_TYPES.PUBLIC, BOARD_TYPES.PRIVATE)
      .messages({
        'string.base': 'Board type must be a text value.',
        'any.only': `Board type must be either "${BOARD_TYPES.PUBLIC}" or "${BOARD_TYPES.PRIVATE}".`
      }),
    columnOrderIds: Joi.array().items(Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)).default([])
  })

  try {
    await correctCondition.validateAsync(req.body, {
      abortEarly: false,
      allowUnknown: true
    })
    next()
  } catch (error) {
    next(error)
  }
}

const moveCardToDifferentColumn = async (req, res, next) => {
  const correctCondition = Joi.object({
    currentCardId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
    prevColumnId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
    prevCardOrderIds: Joi.array().required().items(Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)).default([]),
    nextColumnId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
    nextCardOrderIds: Joi.array().required().items(Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)).default([]),
    boardId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)
  })

  try {
    await correctCondition.validateAsync(req.body, { abortEarly: false })
    next()
  } catch (error) {
    next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, new Error(error).message))
  }
}

export const boardValidation = {
  createNew,
  update,
  moveCardToDifferentColumn
}