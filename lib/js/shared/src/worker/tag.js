const _ = require('lodash')

const UUID_MATCHER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const UUID_DISPLAY_SIZE = 4
const ARG_DELIMITER = '.'

const isUuid = uuid =>
    UUID_MATCHER.test(uuid)

const toString = value =>
    _.isString(value)
        ? isUuid(value)
            ? value.substr(-UUID_DISPLAY_SIZE)
            : value
        : JSON.stringify(value)

const argsJoiner = args =>
    _.compact(args.map(arg => toString(arg))).join(ARG_DELIMITER)

const tag = (tag, ...args) => `${tag}<${argsJoiner(args)}>`

const jobTag = (jobName, jobId) => tag('Job', jobName, jobId)
const workerTag = (jobName, workerId) => tag('Worker', jobName, workerId)
const taskTag = taskName => tag('Task', taskName)
const channelTag = (channelId, conversationId, direction, end) => tag('Channel', channelId, conversationId, direction, end)
const channelListenerTag = listenerId => tag('ChannelListener', listenerId)
const transportTag = transportId => tag('Transport', transportId)

module.exports = {
    tag,
    jobTag,
    workerTag,
    taskTag,
    channelTag,
    channelListenerTag,
    transportTag
}
