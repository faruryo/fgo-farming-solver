import { origin, region } from "../constants/atlasacademy"
import { Servant } from "../interfaces"
import { fetchJsonWithCache } from "./cache"
import { getHash } from "./get-hash"


export const getNiceServants = async () => {
    const url = `${origin}/export/${region}/nice_servant.json`
    const hash = await getHash()
    const servants: Servant[] = await fetchJsonWithCache(url, hash)
    return servants
}