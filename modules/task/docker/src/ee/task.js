const ee = require('ee')
const {interval, of, throwError} = require('rx')
const {map, switchMap, finalize, catchError, mapTo, first, exhaustMap, distinctUntilChanged, takeWhile} = require('rx/operators')
const MONITORING_FREQUENCY = 10000
const {UNSUBMITTED, READY, RUNNING, FAILED} = ee.data.ExportState
const log = require('sepal/log').getLogger('ee')

const runTask$ = (task, description) => {

    const start$ = task =>
        ee.$({
            operation: `start task (${description})`,
            ee: (resolve, reject) =>
                ee.data.startProcessing(null, task.config_, (result, error) =>
                    error
                        ? reject(error)
                        : resolve(result.taskId)
                )
        })

    const status$ = taskId =>
        ee.$({
            operation: `get task status (${description})`,
            ee: (resolve, reject) =>
                ee.data.getTaskStatus(taskId,
                    (status, error) => error
                        ? reject(error)
                        : resolve(status)
                )
        }).pipe(
            map(([status]) => status)
        )

    const cancel$ = taskId =>
        ee.$({
            operation: `cancel task (${description})`,
            ee: (resolve, reject) =>
                ee.data.cancelTask(taskId,
                    (_canceled, error) => error
                        ? reject(error)
                        : resolve()
                )
        })

    const monitor$ = taskId =>
        interval(MONITORING_FREQUENCY).pipe(
            exhaustMap(() => status$(taskId)),
            switchMap(({state, error_message: error}) => error || state === FAILED
                ? throwError(new Error(error))
                : of(state)
            ),
            distinctUntilChanged(),
            takeWhile(state => isRunning(state)),
            map(toProgress)
        )

    const toProgress = state => {
        switch (state) {
        case 'UNSUBMITTED':
            return {
                state,
                defaultMessage: 'Submitting export task to Google Earth Engine',
                messageKey: 'tasks.ee.export.pending'
            }
        case 'READY':
            return {
                state,
                defaultMessage: 'Waiting for Google Earth Engine to start export',
                messageKey: 'tasks.ee.export.ready'
            }
        case 'RUNNING':
            return {
                state,
                defaultMessage: 'Google Earth Engine is exporting',
                messageKey: 'tasks.ee.export.running'
            }
        default:
            throw Error(`Unknown state: ${state}`)
        }
    }

    const cleanup = taskId =>
        status$(taskId).pipe(
            map(({state}) => isRunning(state)),
            switchMap(running =>
                running
                    ? cancel$(taskId).pipe(
                        mapTo(true)
                    )
                    : of(false)
            ),
            first(),
            catchError(() => of(false))
        ).subscribe({
            next: wasRunning => log.info(`EE task ${taskId}: ${wasRunning ? 'Cancelled' : 'Completed'} (${description})`),
            error: error => log.error('Failed to cancel EE task', error)
        })

    const isRunning = state => [UNSUBMITTED, READY, RUNNING].includes(state)

    return of(task).pipe(
        switchMap(task => start$(task)),
        switchMap(taskId => monitor$(taskId).pipe(
            finalize(() => cleanup(taskId))
        ))
    )
}

module.exports = runTask$
