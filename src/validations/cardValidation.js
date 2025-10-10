import Joi from 'joi'
import { StatusCodes } from 'http-status-codes'
import ApiError from '~/utils/ApiError'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

const createNew = async (req, res, next) => {
  const correctCondition = Joi.object({
    boardId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
    columnId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
    title: Joi.string()
      .min(3)
      .max(40)
      .trim()
      .strict()
      .messages({
        'string.base': 'Title must be a text value.',
        'string.empty': 'Title cannot be empty.',
        'string.min': 'Title must be at least {#limit} characters long.',
        'string.max': 'Title must not exceed {#limit} characters.'
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
      .max(40)
      .trim()
      .strict()
      .messages({
        'string.base': 'Title must be a text value.',
        'string.empty': 'Title cannot be empty.',
        'string.min': 'Title must be at least {#limit} characters long.',
        'string.max': 'Title must not exceed {#limit} characters.'
      }),
    comment: Joi.object({
      content: Joi.string()
        .required()
        .min(1)
        .max(500)
        .trim()
        .strict()
        .messages({
          'any.required': 'Comment is required.',
          'string.empty': 'Comment cannot be empty.',
          'string.min': 'Comment must be at least {#limit} character long.',
          'string.max': 'Comment must not exceed {#limit} characters.',
          'string.base': 'Comment must be a text value.'
        })
    })
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

const deleteItem = async (req, res, next) => {
  const correctCondition = Joi.object({
    id: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)
  })

  try {
    await correctCondition.validateAsync({ id: req.params.id })
    next()
  } catch (error) {
    next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, new Error(error).message))
  }
}

export const cardValidation = {
  createNew,
  update,
  deleteItem
}