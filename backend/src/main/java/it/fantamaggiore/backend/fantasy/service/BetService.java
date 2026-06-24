package it.fantamaggiore.backend.fantasy.service;

import it.fantamaggiore.backend.core.exceptions.InvalidActionException;
import it.fantamaggiore.backend.core.exceptions.ResourceNotFoundException;
import it.fantamaggiore.backend.core.model.MatchDay;
import it.fantamaggiore.backend.core.model.User;
import it.fantamaggiore.backend.core.model.enums.MatchDayStatus;
import it.fantamaggiore.backend.core.repository.UserRepository;
import it.fantamaggiore.backend.core.service.MatchDayService;
import it.fantamaggiore.backend.core.service.UserService;
import it.fantamaggiore.backend.fantasy.model.Bet;
import it.fantamaggiore.backend.fantasy.model.BetPrediction;
import it.fantamaggiore.backend.fantasy.model.enums.BetStatus;
import it.fantamaggiore.backend.fantasy.model.enums.PredictionType;
import it.fantamaggiore.backend.fantasy.repository.BetPredictionRepository;
import it.fantamaggiore.backend.fantasy.repository.BetRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;

@Service
public class BetService {

    @Autowired private UserService userService;
    @Autowired private UserRepository userRepository;
    @Autowired private MatchDayService matchDayService;
    @Autowired private BetRepository betRepository;
    @Autowired private BetPredictionRepository predictionRepository;
    @Autowired private SimpMessagingTemplate messagingTemplate;

    private void notifyWebSocket() {
        messagingTemplate.convertAndSend("/topic/rankings", (Object) Collections.singletonMap("action", "RELOAD"));
    }

    @Transactional
    public Bet createBet(String userEmail, Long matchDayId, String description) {
        User creator = userService.getUserByEmail(userEmail);
        MatchDay matchDay = matchDayService.getMatchDayById(matchDayId);

        if (matchDay.getStatus() != MatchDayStatus.OPEN) throw new InvalidActionException("Scommesse chiuse!");

        Bet bet = new Bet();
        bet.setDescription(description);
        bet.setCreator(creator);
        bet.setMatchDay(matchDay);
        Bet saved = betRepository.save(bet);

        notifyWebSocket();
        return saved;
    }

    @Transactional
    public void placePrediction(Long betId, String userEmail, PredictionType type) {
        User user = userService.getUserByEmail(userEmail);
        Bet bet = betRepository.findById(betId).orElseThrow();

        if (bet.getMatchDay().getStatus() != MatchDayStatus.OPEN) throw new InvalidActionException("Mercato chiuso!");

        // Se esiste già, la aggiorniamo (Cambio idea)
        BetPrediction prediction = predictionRepository.findByBetIdAndUserId(betId, user.getId())
                .orElse(new BetPrediction());

        prediction.setUser(user);
        prediction.setBet(bet);
        prediction.setPrediction(type);
        predictionRepository.save(prediction);

        notifyWebSocket();
    }

    @CacheEvict(value = "globalRanking", allEntries = true)
    @Transactional
    public void resolveBet(Long betId, BetStatus finalStatus, boolean isAdmin) {
        // 🔥 FIX: Controlliamo direttamente il boolean
        if (!isAdmin) throw new InvalidActionException("Solo l'admin può risolvere!");

        Bet bet = betRepository.findById(betId).orElseThrow();
        if (bet.getStatus() != BetStatus.PENDING) throw new InvalidActionException("Scommessa già chiusa!");

        bet.setStatus(finalStatus);

        for (BetPrediction p : bet.getPredictions()) {
            boolean isWinner = (finalStatus == BetStatus.WON && p.getPrediction() == PredictionType.YES) ||
                    (finalStatus == BetStatus.LOST && p.getPrediction() == PredictionType.NO);

            // 🔥 FIX: Assegnamo il punto SOLO se ha vinto E NON è bannato!
            if (isWinner && !p.getUser().isLocked()) {
                User u = p.getUser();
                u.setBetPoints(u.getBetPoints() + 1);
                userRepository.save(u);
            }
        }
        betRepository.save(bet);
        notifyWebSocket();
    }

    @Transactional
    public void deleteBet(Long betId, String userEmail, boolean isAdmin) {
        Bet bet = betRepository.findById(betId).orElseThrow();
        // 🔥 FIX: Controlliamo direttamente il boolean
        if (!bet.getCreator().getEmail().equals(userEmail) && !isAdmin) {
            throw new InvalidActionException("Non hai i permessi!");
        }
        betRepository.delete(bet);
        notifyWebSocket();
    }

    @Transactional
    public Bet updateBetDescription(Long betId, String newDesc, String userEmail) {
        Bet bet = betRepository.findById(betId).orElseThrow();

        if (!bet.getCreator().getEmail().equals(userEmail)) {
            throw new InvalidActionException("Non hai i permessi per modificare questa scommessa!");
        }
        // 🔥 Aggiunti blocchi temporali
        if (bet.getMatchDay().getStatus() != MatchDayStatus.OPEN) {
            throw new InvalidActionException("Non puoi modificare a giornata iniziata!");
        }
        if (bet.getStatus() != BetStatus.PENDING) {
            throw new InvalidActionException("Scommessa già chiusa!");
        }

        bet.setDescription(newDesc);
        Bet saved = betRepository.save(bet);

        notifyWebSocket(); // Tutti vedranno il testo aggiornato!
        return saved;
    }

    @Transactional(readOnly = true)
    public List<Bet> getBetsByMatchDay(Long matchDayId) {
        MatchDay matchDay = matchDayService.getMatchDayById(matchDayId);
        List<Bet> bets = betRepository.findByMatchDayId(matchDayId);

        if (matchDay.getStatus() == MatchDayStatus.OPEN) {
            // Rimuoviamo le scommesse create da utenti che ora sono bannati
            bets = bets.stream()
                    .filter(bet -> !bet.getCreator().isLocked())
                    .toList();
        }
        return bets;
    }

    @Transactional(readOnly = true)
    public List<Bet> getAllBets() { return betRepository.findAll(); }

    @Transactional(readOnly = true)
    public List<Bet> getMyBets(String userEmail) {
        User user = userService.getUserByEmail(userEmail);
        return betRepository.findByCreatorOrUserHasPredicted(user);
    }

    @Transactional
    public void deleteAllBets(List<Bet> bets) { betRepository.deleteAll(bets); }

    @Transactional
    public void removePrediction(Long betId, String userEmail) {
        User user = userService.getUserByEmail(userEmail);
        Bet bet = betRepository.findById(betId).orElseThrow();

        if (bet.getMatchDay().getStatus() != MatchDayStatus.OPEN) {
            throw new InvalidActionException("Non puoi annullare a giornata iniziata!");
        }

        predictionRepository.findByBetIdAndUserId(betId, user.getId())
                .ifPresent(predictionRepository::delete);

        notifyWebSocket();
    }
}