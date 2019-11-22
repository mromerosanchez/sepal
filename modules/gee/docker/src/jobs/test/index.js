const job = require('@sepal/job')

const worker$ = (count, minDuration, maxDuration = minDuration) => {
    const {of, timer} = require('rxjs')
    const {mergeMap, map} = require('rxjs/operators')
    // const rateLimit = require('../job/operators/rateLimit')

    const sequence = [...Array(count).keys()]
    return of(...sequence).pipe(
        // rateLimit(3, 1000),
        map(() => Math.random() * (maxDuration - minDuration) + minDuration),
        mergeMap(value =>
            timer(value).pipe(
                map(() => {
                    if (Math.random() < 1) {
                        // throw new Error('Random error!')
                    }
                    return Math.random()
                }),
            )
        )
    )
}

module.exports = job({
    jobName: 'Test1',
    jobPath: __filename,
    before: [require('./test_1'), require('./test_2')],
    args: _ctx => [1, 1000, 2000],
    worker$
})