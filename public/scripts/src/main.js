import $ from 'jquery'
import Hammer from 'hammerjs'
import Materialize from 'materialize-css'

const M =  window.Materialize

$(function(){
  
  // Set to 'true' to enforce BrowserSync proxy port redirection
  const PROXY_SWITCH = true
  const PROXY_PORT = 3000

  const CALLBACK_URL =  '/callback'
  const SAFETREK_API_URL =  'https://api-sandbox.safetrek.io/v1'
  const DEFAULT_ACCURACY =  5
  const RANDOM_ADDRESS_DATA = '/address-us-100.min.json'

  const ls = localStorage
  const log = console.log
  const logErr = console.error
  const logWarn = console.warn
  let state = new Map

  const setState = (key, val, verbose = false) => {
    ls.setItem(key, val)
    state.set(key, val)
    if (verbose) log('State changed!', `${key} has new value. Current State:\n`, state)
  }

  const copyAccessToken = () => {
    $('input#access_token').focus().select()
    document.execCommand('Copy')
    $('input#access_token').blur()
    M.toast('Access token copied !', 2000)
  }

  // Redirect to browser-sync proxy port
  if(location.hostname === 'localhost' && +location.port !== PROXY_PORT && PROXY_SWITCH) {
    location.port = PROXY_PORT
  } else {

    // Function to fetch URL parameters
    const urlParam = (name, url = window.location.href) => {
      let results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(url)
      return results ? decodeURIComponent(results[1]) : 0
    }

    // State Initialization
    state.set('status', 'disconnected')
    state.set('authorization_code', ls.getItem('authorization_code') || '')
    state.set('refresh_token', ls.getItem('refresh_token') || '')
    state.set('access_token', ls.getItem('access_token') || '')

    // Materialize Components Initialization
    $('.button-collapse').sideNav()
    $('.tooltipped').tooltip()

    // Update state based on query params
    if(urlParam('authorization_code') && urlParam('access_token') && urlParam('refresh_token')) {
      setState('authorization_code', urlParam('authorization_code'))
      setState('access_token', urlParam('access_token'))
      setState('refresh_token', urlParam('refresh_token'))
    }

    if(state.get('authorization_code')) {
      state.set('status', 'connected')
      log('SafeTrek is connected! Current State:', state)
      document.getElementById('disconnected').style.display = 'none';
      document.getElementById('connected').style.display = 'inline';
    } else {
      logWarn('SafeTrek is not connected! Current State:\n', state)
    }

    // Prevent changing code and token field values
    $('input.display-only').on('blur', function() {
      $(this).val(state.get($(this).attr('id')))
    })

    // Disconnect from SafeTrek. Clear all data and reload page.
    $('button.safetrek-btn').on('click', function(e){
      e.preventDefault()
      let that = $(this)
      if(state.get('status') !== 'disconnected') {
        ls.clear()
        location.href = location.origin + location.pathname
      } else {
        let url = ''
        if(that.attr('data-localhost') === 'true') {
          url = that.attr('data-href')
          url += that.attr('data-protocol')
          url += '://localhost:'
          url += that.attr('data-port')
          url += that.attr('data-callback')
        } else {
          url = that.attr('data-href')
          url += that.attr('data-redirect')
        }
        location.href = url
        document.getElementById('disconnected').style.display = 'inline';
        document.getElementById('connected').style.display = 'none';
      }
    })

    // Exchange refresh_token for new access_token
    $('.new-token').on('click', function() {
      let that = $(this)
      that.prop('disabled', true)
      $('input#access_token').prop('disabled', true).val('')
      let url = `${CALLBACK_URL}?refresh_token=${state.get('refresh_token')}`
      $.ajax({
        url: url,
        dataType: 'json',
        success: (data) => {
          setState('access_token', data.access_token, true)
          $('input#access_token').val(data.access_token)
        },
        error: (xhr, status, err) => { logErr('Error:', err) },
        complete: () => { 
          that.prop('disabled', false)
          $('input#access_token').prop('disabled', false)
        }
      })
    })

    $('.make-alarm-request').on('click', function(e) {
      e.preventDefault()
      if (state.get('status') === 'active-alarm') {
        log('Alarm is currently active and will reset in 10s or less.')
      } else if(state.get('status') !== 'processing') {
        if(state.get('access_token')) {
          state.set('status', 'processing')
          let url = SAFETREK_API_URL + '/alarms'
          let data = $('code.alarm-request').text()
          log('Requesting Alarm creation with data:\n', data)
          $.ajax({
            url: url,
            type: 'post',
            headers: {
              'Authorization': `Bearer ${state.get('access_token')}`
            },
            contentType: 'application/json',
            dataType: 'json',
            data: data,
            success: (data) => {
              log('Alarm created successfully! Server response:\n', JSON.stringify(data, null, 2), '\nAlarm status will reset in 10s.')
              $('.alarm').addClass('alarm-red')
            },
            error: (xhr, status, err) => { logErr('Error:', err) },
            complete: () => {
              state.set('status', 'active-alarm')
              $('.alarm-status').text('')
              setTimeout(() => {
                state.set('status', 'connected')
                $('.alarm').removeClass('alarm-red')
                log('Alarm status reset!')
                $('.status-message').html('')
              }, 10000)
            }
          })
        } else {
          M.toast('SafeTrek needs to be connected.', 2000)
          logErr('No valid access_token found! Connect to SafeTrek before requesting Alarm creation.')
        }
      }
    })

    $('.safety').on('click', function(e) {
      e.preventDefault()
      $.getJSON(RANDOM_ADDRESS_DATA, (data) => {
        const addresses = data.addresses
        const randomAddress = addresses[Math.floor(Math.random() * addresses.length)]
        let responseJSON = {
          "services": {
            "police": true,
            "fire": true,
            "medical": true
          },
          "location.address": {
            "line1": randomAddress.address1,
            "line2": randomAddress.address2,
            "city": randomAddress.city,
            "state": randomAddress.state,
            "zip": randomAddress.postalCode
          }
        }
        $('.status-message').html('<p>Your safety request has been processed.</p>')
        $('code.alarm-request').text(JSON.stringify(responseJSON, null, 2))
      })
    })

    $('.injury').on('click', function(e) {
      e.preventDefault()
      $.getJSON(RANDOM_ADDRESS_DATA, (data) => {
        const addresses = data.addresses
        const randomAddress = addresses[Math.floor(Math.random() * addresses.length)]
        let responseJSON = {
          "services": {
            "police": false,
            "fire": false,
            "medical": true
          },
          "location.address": {
            "line1": randomAddress.address1,
            "line2": randomAddress.address2,
            "city": randomAddress.city,
            "state": randomAddress.state,
            "zip": randomAddress.postalCode
          }
        }
        $('.status-message').html('<p>Your injury request has been processed.</p>')
        $('code.alarm-request').text(JSON.stringify(responseJSON, null, 2))
      })
    })

    $('span.access_token, button.copy-token').on('click', function(){
      copyAccessToken()
    })

  }
})

$(document).ready(function() {
  $(function loadInfo(){
      var tips = [
        {
          title: "📱 LiveSafe App",
          text: "Advisory messages are not life-threatening and may include campus incidents such as a power outage or a water leak. Using active geofence location, advisories target specific areas where an incident is occurring. To receive these advisories, please be sure to enable location-services on your smartphone. ASU Alerts, life-threatening situations such as a major fire or an armed suspect on campus, are sent via these methods.",
          img: "https://cfo.asu.edu/livesafe-mobile-app"
        },
        {
          title: "🚲 Bike Security",
          text: "Register your bike with the ASU Police. It is important to register your bike with us even if your bicycle is registered with another program or law enforcement agency. Always lock your bike to a bicycle rack. Secure the U-lock through the bike frame,the rear wheel and the bicycle rack.",
          link: "https://cfo.asu.edu/bike-safety"
        },
        {
          title: "🚘 Safety Escort",
          text: "The Undergraduate Student Government provides a complimentary student escort service on all 4 campuses. Request a one-time or routine pick-up through the LiveSafe app or through the web form.",
          link: "https://www.asuusg.com/#!services/g0vkh"
        },
        {
          title: "🛡️ Self Defense Courses",
          text: "The Arizona State University Police Department provides free Rape Aggression Defense Systems self-defense courses for any ASU community member. R.A.D. Basic and R.A.D. for Men are 9-to-12 hours of self-defense training. R.A.D. Advanced is an eight-hour session that may be taken after completing R.A.D. Basic.",
          link: "https://cfo.asu.edu/rad"
        },
        {
          title: "🛡️ Sexual Violence Prevention",
          text: "It might surprise you to know that about 9 out of 10 sexual assaults are committed by someone the victim knows, not a stranger. Take Action to Stop Sexual Violence – we can all step up to challenge community norms and create change.",
          link: "https://wellness.asu.edu/explore-wellness/community-support/violence-prevention/sexual-violence"
        }
      ];
      var tip = tips[Math.floor(Math.random() * tips.length)];
      document.getElementById("tip").innerHTML = '<p><b>' + tip.title + '</b> - ' + tip.text + '<p>';
      document.getElementById("moreinfo").innerHTML = '<a class="button" target="_blank" href="' + tip.link + '"> Learn More 👉</a>';
  }); 
});