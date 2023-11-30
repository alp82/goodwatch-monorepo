import { Poster } from '~/ui/Poster'

export const CardLoader = () =>  (
    <>
      {Array(10).fill(0).map((_, index) => (
        <Poster key={index} loading={true} />
      ))}
    </>
  )