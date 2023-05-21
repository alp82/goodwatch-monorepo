import * as brain from 'brain.js'
import * as fs from 'fs'
import { IRNNTrainingOptions } from 'brain.js/dist/recurrent/rnn'

const filename = 'net-certifications.json'
const options: Partial<IRNNTrainingOptions> = {
  iterations: 20000,
  log: true,
  logPeriod: 100,
}

export const trainAndSave = () => {
  // Define the training data
  const letters = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

  const trainingData = [
    // general audience / unrestricted
    { input: ' ', output: 'GA' },
    { input: 'Genel İzleyici', output: 'GA' },
    { input: 'Mládeži přistupný', output: 'GA' },
    { input: '전체관람가', output: 'GA' },
    { input: '普遍級', output: 'GA' },
    { input: '전체', output: 'GA' },
    { input: ' ท ทั่วไป ', output: 'GA' },
    { input: 'Unrestricted', output: 'GA' },

    // invalid data
    { input: 'Vertical Entertainment', output: 'GA' },
    { input: 'How to train your dragon: homecoming', output: 'GA' },

    // correct syntax
    { input: 'PG', output: 'PG' },
    { input: 'TV-PG', output: 'TV-PG' },
    ...letters.map((letter => ( { input: letter, output: letter }))),
    ...[...Array(22).keys()].map((num => ( { input: num.toString(), output: num.toString() }))),
    ...[...Array(22).keys()].map((num => ( { input: `${num.toString()}A`, output: `${num.toString()}A` }))),
    ...[...Array(22).keys()].map((num => ( { input: `${num.toString()}+`, output: `${num.toString()}+` }))),
    ...[...Array(22).keys()].map((num => ( { input: `+${num.toString()}`, output: `+${num.toString()}` }))),
    ...[...Array(22).keys()].map((num => ( { input: `B${num.toString()}`, output: `B${num.toString()}` }))),
    ...[...Array(22).keys()].map((num => ( { input: `K-${num.toString()}`, output: `K-${num.toString()}` }))),
    ...[...Array(22).keys()].map((num => ( { input: `PG-${num.toString()}`, output: `PG-${num.toString()}` }))),
    ...[...Array(22).keys()].map((num => ( { input: `R-${num.toString()}`, output: `R-${num.toString()}` }))),

    // wrong case
    ...[...Array(22).keys()].map((num => ( { input: `pg-${num.toString()}`, output: `PG-${num.toString()}` }))),

    // prefixes or suffixes
    ...letters.map((letter => ( { input: `เรท ${letter}`, output: letter }))),
    ...[...Array(22).keys()].map((num => ( { input: `輔${num.toString()}`, output: num.toString() }))),
    ...[...Array(22).keys()].map((num => ( { input: `ฉ${num.toString()}`, output: num.toString() }))),
    ...[...Array(22).keys()].map((num => ( { input: `น ${num.toString()}`, output: num.toString() }))),
    ...[...Array(22).keys()].map((num => ( { input: `SAM ${num.toString()}`, output: num.toString() }))),
    ...[...Array(22).keys()].map((num => ( { input: `Category ${num.toString()}`, output: num.toString() }))),
    ...[...Array(22).keys()].map((num => ( { input: `I.M. - ${num.toString()}`, output: num.toString() }))),
    ...[...Array(22).keys()].map((num => ( { input: `${num.toString()} anos`, output: num.toString() }))),
    ...[...Array(22).keys()].map((num => ( { input: `${num.toString()}세관람가(청소년관람불가)`, output: num.toString() }))),
    ...[...Array(22).keys()].map((num => ( { input: `${num.toString()} éven aluliak számára nem ajánlott`, output: num.toString() }))),
    ...[...Array(22).keys()].map((num => ( { input: `od ${num.toString()} lat `, output: num.toString() }))),
    ...[...Array(22).keys()].map((num => ( { input: ` ומעלה${num.toString()}הותר לבני `, output: num.toString() }))),

    // multiple ratings
    { input: 'NC16 (uncut) PG13 (edited)', output: 'NC16 (uncut) PG13 (edited)' },
  ]

  // Create a neural network
  const net = new brain.recurrent.LSTM()

  // Train the network
  console.log(`Starting training with ${trainingData.length} examples...`)
  net.train(trainingData, options)
  const networkData = net.toJSON()

  fs.writeFile(filename, JSON.stringify(networkData), err => {
    if (err) throw err
    console.log('Certification network saved to file')
  });
}

export const loadAndTest = () => {
  fs.readFile(filename, 'utf8', (err, data) => {
    if (err) throw err
    const networkData = JSON.parse(data)
    const net = new brain.recurrent.LSTM()
    net.fromJSON(networkData)

    // Test the network
    const testData = [
      ' ',
      '18세관람가(청소년관람불가)',
      'Unrestricted',
      'Genel İzleyici',
      'Mládeži přistupný',
      '전체관람가',
      'SAM 18',
      'K-18',
      'น 18+',
      'pg-13',
      '7',
      '輔12',
      'הותר לבני 10 ומעלה',
      'od 15 lat',
      '18 éven aluliak számára nem ajánlott',
      'NC16 (uncut) PG13 (edited)',
      '0',
      '2',
      '12',
      '13',
      'PG-17',
    ]
    testData.forEach((value) => {
      const result = net.run(value)
      console.log(`${value} => ${result}`)
    })
  });

}
